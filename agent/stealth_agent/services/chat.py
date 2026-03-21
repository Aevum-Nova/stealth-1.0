"""Chat service — manages conversations with LLM context from feature requests and codebase."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from stealth_agent.adapters.llm import LLMProvider
from stealth_agent.mappers import feature_request_from_row
from stealth_agent.models import AgentConversation, AgentJob, AgentMessage, FeatureRequestRow
from stealth_agent.services.change_parser import extract_proposed_changes
from stealth_agent.services.code_retriever import RetrievedChunk, find_github_connector_for_org, retrieve_relevant_chunks

log = structlog.get_logger()


SUMMARY_SYSTEM_PROMPT = (
    "You are a product analyst. Given a feature request and its supporting customer signals, "
    "write a concise 2-4 sentence summary that explains: "
    "(1) what change customers are asking for, "
    "(2) which sources these signals came from, "
    "(3) why this feature request matters. "
    "Write in third person. Do not use bullet points or markdown. Be specific about the actual request, not generic."
)


async def generate_summary(
    db: AsyncSession,
    llm: LLMProvider,
    feature_request_id: str,
    organization_id: str,
) -> str:
    """Generate an LLM summary for a feature request and persist it."""
    fr_result = await db.execute(
        select(FeatureRequestRow).where(
            FeatureRequestRow.id == uuid.UUID(feature_request_id),
            FeatureRequestRow.organization_id == uuid.UUID(organization_id),
        )
    )
    fr_row = fr_result.scalar_one_or_none()
    if not fr_row:
        raise ValueError("Feature request not found")

    if fr_row.synthesis_summary:
        return fr_row.synthesis_summary

    evidence = fr_row.supporting_evidence or []
    evidence_lines = []
    for e in evidence:
        source = e.get("source", "unknown")
        company = e.get("customer_company") or "unknown company"
        quote = e.get("representative_quote") or e.get("signal_summary") or ""
        evidence_lines.append(f"- [{source}, {company}]: {quote}")

    metrics = fr_row.impact_metrics or {}
    source_breakdown = metrics.get("source_breakdown", {})

    user_content = (
        f"Feature request title: {fr_row.title}\n"
        f"Type: {fr_row.type}\n"
        f"Problem statement: {fr_row.problem_statement}\n"
        f"Proposed solution: {fr_row.proposed_solution}\n"
        f"Signal count: {metrics.get('signal_count', len(evidence))}\n"
        f"Sources: {', '.join(f'{k} ({v})' for k, v in source_breakdown.items()) or 'unknown'}\n"
        f"Supporting evidence:\n" + "\n".join(evidence_lines)
    )

    summary = await llm.complete(
        SUMMARY_SYSTEM_PROMPT,
        [{"role": "user", "content": user_content}],
        max_tokens=300,
    )
    summary = summary.strip()

    fr_row.synthesis_summary = summary
    await db.commit()

    return summary


async def get_or_create_conversation(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> AgentConversation:
    fr_uuid = uuid.UUID(feature_request_id)
    org_uuid = uuid.UUID(organization_id)

    async def _load_conversations() -> list[AgentConversation]:
        result = await db.execute(
            select(AgentConversation)
            .where(
                AgentConversation.feature_request_id == fr_uuid,
                AgentConversation.organization_id == org_uuid,
            )
            .order_by(AgentConversation.created_at.asc(), AgentConversation.id.asc())
        )
        return list(result.scalars().all())

    conversations = await _load_conversations()
    if conversations:
        canonical = conversations[0]
        duplicates = conversations[1:]
        if not duplicates:
            return canonical

        duplicate_ids = [conversation.id for conversation in duplicates]
        await db.execute(
            update(AgentMessage)
            .where(AgentMessage.conversation_id.in_(duplicate_ids))
            .values(conversation_id=canonical.id)
        )
        for duplicate in duplicates:
            await db.delete(duplicate)
        await db.flush()

        log.warning(
            "agent_conversations_deduplicated",
            feature_request_id=feature_request_id,
            organization_id=organization_id,
            canonical_conversation_id=str(canonical.id),
            duplicate_count=len(duplicates),
        )
        return canonical

    conversation = AgentConversation(
        id=uuid.uuid4(),
        feature_request_id=fr_uuid,
        organization_id=org_uuid,
    )
    db.add(conversation)
    try:
        await db.flush()
        return conversation
    except IntegrityError:
        # A concurrent request created the row after our initial read. Reset the
        # transaction state and return the now-canonical conversation.
        await db.rollback()
        conversations = await _load_conversations()
        if conversations:
            return conversations[0]
        raise


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> list[AgentMessage]:
    from sqlalchemy import case

    role_order = case(
        (AgentMessage.role == "user", 0),
        (AgentMessage.role == "assistant", 1),
        else_=2,
    )
    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.conversation_id == conversation_id)
        .order_by(AgentMessage.created_at, role_order)
    )
    return list(result.scalars().all())


async def _get_latest_job_result(db: AsyncSession, feature_request_id: str, org_id: str) -> dict | None:
    result = await db.execute(
        select(AgentJob)
        .where(
            AgentJob.feature_request_id == uuid.UUID(feature_request_id),
            AgentJob.organization_id == uuid.UUID(org_id),
            AgentJob.status == "completed",
        )
        .order_by(AgentJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    return job.result if job else None


def _format_code_context(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return ""

    sections = []
    for chunk in chunks:
        header = f"--- {chunk.file_path}:{chunk.start_line}-{chunk.end_line} ({chunk.language}) ---"
        sections.append(f"{header}\n{chunk.content}\n---")

    return "\n\n".join(sections)


def _format_job_context(job_result: dict | None) -> str:
    if not job_result:
        return ""

    parts = []
    if job_result.get("spec_summary"):
        parts.append(f"Summary: {job_result['spec_summary']}")
    if job_result.get("tasks"):
        parts.append("Tasks:\n" + "\n".join(f"  - {t}" for t in job_result["tasks"]))

    proposed = job_result.get("proposed_files") or []
    if proposed:
        sections = []
        for f in proposed:
            path = f.get("file_path", "")
            reason = f.get("reason", "")
            content = f.get("content", "")
            header = f"--- {path} ---"
            if reason:
                header += f"\n# {reason}"
            sections.append(f"{header}\n{content}\n---")
        parts.append("FILES IN CURRENT PR (full content - use these as the codebase):\n" + "\n\n".join(sections))

    return "\n\n".join(parts)


async def chat(
    db: AsyncSession,
    llm: LLMProvider,
    feature_request_id: str,
    organization_id: str,
    user_message: str,
) -> AgentMessage:
    # Load feature request for context
    fr_result = await db.execute(
        select(FeatureRequestRow).where(
            FeatureRequestRow.id == uuid.UUID(feature_request_id),
            FeatureRequestRow.organization_id == uuid.UUID(organization_id),
        )
    )
    fr_row = fr_result.scalar_one_or_none()

    # Build feature request context
    fr_context = ""
    if fr_row:
        domain_fr = feature_request_from_row(fr_row)
        evidence_text = "\n".join(
            f"  - [{e.source_type.value}] {e.snippet}" for e in domain_fr.evidence
        )
        fr_context = (
            f"FEATURE REQUEST:\n"
            f"Title: {domain_fr.title}\n"
            f"Problem: {domain_fr.problem_statement}\n"
            f"Business context: {domain_fr.business_context}\n"
            f"Evidence:\n{evidence_text}"
        )

    # Retrieve relevant code chunks if a GitHub connector is indexed
    code_context = ""
    repo_label = ""
    connector = await find_github_connector_for_org(organization_id)
    if connector:
        config = connector.config or {}
        repo_label = config.get("repository", "")
        try:
            # Primary: user's message
            chunks = await retrieve_relevant_chunks(
                query=user_message,
                connector_id=connector.id,
                organization_id=uuid.UUID(organization_id),
                top_k=20,
            )
            seen = {(c.file_path, c.start_line, c.end_line) for c in chunks}
            # Secondary: feature request context (catches theme/css/etc for "light mode")
            if fr_row:
                fr_query = f"{fr_row.title} {fr_row.problem_statement}"
                extra = await retrieve_relevant_chunks(
                    query=fr_query,
                    connector_id=connector.id,
                    organization_id=uuid.UUID(organization_id),
                    top_k=16,
                )
                for c in extra:
                    key = (c.file_path, c.start_line, c.end_line)
                    if key not in seen:
                        seen.add(key)
                        chunks.append(c)
            code_context = _format_code_context(chunks[:32])
        except Exception as exc:
            log.warning("code_retrieval_failed", error=str(exc))

    # Get latest job result for continuity
    job_result = await _get_latest_job_result(db, feature_request_id, organization_id)
    job_context = _format_job_context(job_result)

    # Build system prompt
    system_parts = [
        "You are a codebase-aware engineering assistant with access to the user's repository."
    ]
    if repo_label:
        system_parts[0] += f" The linked repo is {repo_label}."
    system_parts[0] += (
        " You receive full file contents from the current PR (when available), "
        "plus semantically retrieved code from the indexed repository. "
        "Do NOT claim you lack repository access — you have it via the context provided."
    )

    if fr_context:
        system_parts.append(fr_context)
    # PR files first (most authoritative) — full content of files in the current PR
    if job_context:
        system_parts.append(job_context)
    if code_context:
        system_parts.append(f"ADDITIONAL CODE (semantic search from indexed repo):\n{code_context}")
    elif connector and repo_label:
        hint = "suggest changes based on the feature request" + (" and PR files above" if job_context else "")
        system_parts.append(f"The repository {repo_label} is indexed. No code chunks matched — {hint}.")

    system_parts.append(
        "Help the user understand the code, reason about implementation, and suggest precise changes.\n\n"
        "IMPORTANT FORMATTING RULES:\n"
        "1. First, write your explanation and reasoning in plain text.\n"
        "2. Use the proposed_changes JSON format ONLY when you are proposing NEW changes for the user to apply to the PR (e.g. implementing a feature, fixing a bug). Do NOT use it when the user asks to SHOW, DISPLAY, or SUMMARIZE existing PR content — for that, use plain markdown and code blocks only.\n"
        "3. When proposing NEW changes: ALL proposed file changes MUST go at the VERY END as a JSON array inside a ```json block. Do NOT use headings like '# Proposed Changes for X' with inline code blocks.\n"
        "4. The prose explains your approach; the JSON contains the actual files. The UI renders each as a collapsible Apply-to-PR card.\n"
        "5. Keep explanations concise and focused.\n\n"
        "JSON format (one object per file, for NEW proposals only):\n"
        '```json\n[{"file_path": "path/to/file.css", "content": "full file content...", "reason": "short reason"}]\n```'
    )

    system = "\n\n".join(system_parts)

    # Get or create conversation
    conversation = await get_or_create_conversation(db, feature_request_id, organization_id)

    # Save user message
    user_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.flush()

    # Build message history for LLM
    all_messages = await get_conversation_messages(db, conversation.id)
    llm_messages = [{"role": m.role, "content": m.content} for m in all_messages if m.role != "system"]

    # Call LLM
    response_text = await llm.complete(system, llm_messages)

    # Parse any proposed changes from the response
    proposed_changes = extract_proposed_changes(response_text)

    # Strip JSON block and "# Proposed Changes for X" + code block from display when extracted
    display_content = response_text
    if proposed_changes:
        import re
        display_content = re.sub(r"```json\s*\n\[[\s\S]*?\]\s*\n```", "", display_content).strip()
        display_content = re.sub(
            r"#+\s*Proposed Changes? (?:for\s+)?[^\n]+\s*\n+```\w*\n[\s\S]*?```",
            "",
            display_content,
            flags=re.IGNORECASE,
        ).strip()
        display_content = re.sub(r"\n*\d+ proposed changes?\s*$", "", display_content, flags=re.IGNORECASE).strip()

    # Save assistant response
    assistant_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="assistant",
        content=display_content,
        proposed_changes=proposed_changes,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return assistant_msg


async def chat_stream(
    db: AsyncSession,
    llm: LLMProvider,
    feature_request_id: str,
    organization_id: str,
    user_message: str,
) -> AsyncIterator[str]:
    """Stream chat response tokens via the LLM, then persist the final message."""
    fr_result = await db.execute(
        select(FeatureRequestRow).where(
            FeatureRequestRow.id == uuid.UUID(feature_request_id),
            FeatureRequestRow.organization_id == uuid.UUID(organization_id),
        )
    )
    fr_row = fr_result.scalar_one_or_none()

    fr_context = ""
    if fr_row:
        domain_fr = feature_request_from_row(fr_row)
        evidence_text = "\n".join(
            f"  - [{e.source_type.value}] {e.snippet}" for e in domain_fr.evidence
        )
        fr_context = (
            f"FEATURE REQUEST:\n"
            f"Title: {domain_fr.title}\n"
            f"Problem: {domain_fr.problem_statement}\n"
            f"Business context: {domain_fr.business_context}\n"
            f"Evidence:\n{evidence_text}"
        )

    code_context = ""
    repo_label = ""
    connector = await find_github_connector_for_org(organization_id)
    if connector:
        config = connector.config or {}
        repo_label = config.get("repository", "")
        try:
            chunks = await retrieve_relevant_chunks(
                query=user_message,
                connector_id=connector.id,
                organization_id=uuid.UUID(organization_id),
                top_k=20,
            )
            seen = {(c.file_path, c.start_line, c.end_line) for c in chunks}
            if fr_row:
                fr_query = f"{fr_row.title} {fr_row.problem_statement}"
                extra = await retrieve_relevant_chunks(
                    query=fr_query,
                    connector_id=connector.id,
                    organization_id=uuid.UUID(organization_id),
                    top_k=16,
                )
                for c in extra:
                    key = (c.file_path, c.start_line, c.end_line)
                    if key not in seen:
                        seen.add(key)
                        chunks.append(c)
            code_context = _format_code_context(chunks[:32])
        except Exception as exc:
            log.warning("code_retrieval_failed", error=str(exc))

    job_result = await _get_latest_job_result(db, feature_request_id, organization_id)
    job_context = _format_job_context(job_result)

    system_parts = [
        "You are a codebase-aware engineering assistant with access to the user's repository."
    ]
    if repo_label:
        system_parts[0] += f" The linked repo is {repo_label}."
    system_parts[0] += (
        " You receive full file contents from the current PR (when available), "
        "plus semantically retrieved code from the indexed repository. "
        "Do NOT claim you lack repository access — you have it via the context provided."
    )

    if fr_context:
        system_parts.append(fr_context)
    if job_context:
        system_parts.append(job_context)
    if code_context:
        system_parts.append(f"ADDITIONAL CODE (semantic search from indexed repo):\n{code_context}")
    elif connector and repo_label:
        hint = "suggest changes based on the feature request" + (" and PR files above" if job_context else "")
        system_parts.append(f"The repository {repo_label} is indexed. No code chunks matched — {hint}.")

    system_parts.append(
        "Help the user understand the code, reason about implementation, and suggest precise changes.\n\n"
        "IMPORTANT FORMATTING RULES:\n"
        "1. First, write your explanation and reasoning in plain text.\n"
        "2. Use the proposed_changes JSON format ONLY when you are proposing NEW changes for the user to apply to the PR (e.g. implementing a feature, fixing a bug). Do NOT use it when the user asks to SHOW, DISPLAY, or SUMMARIZE existing PR content — for that, use plain markdown and code blocks only.\n"
        "3. When proposing NEW changes: ALL proposed file changes MUST go at the VERY END as a JSON array inside a ```json block. Do NOT use headings like '# Proposed Changes for X' with inline code blocks.\n"
        "4. The prose explains your approach; the JSON contains the actual files. The UI renders each as a collapsible Apply-to-PR card.\n"
        "5. Keep explanations concise and focused.\n\n"
        "JSON format (one object per file, for NEW proposals only):\n"
        '```json\n[{"file_path": "path/to/file.css", "content": "full file content...", "reason": "short reason"}]\n```'
    )

    system = "\n\n".join(system_parts)

    conversation = await get_or_create_conversation(db, feature_request_id, organization_id)

    user_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.flush()

    all_messages = await get_conversation_messages(db, conversation.id)
    llm_messages = [{"role": m.role, "content": m.content} for m in all_messages if m.role != "system"]

    full_response = []
    async for token in llm.stream(system, llm_messages):
        full_response.append(token)
        yield token

    response_text = "".join(full_response)
    proposed_changes = extract_proposed_changes(response_text)

    display_content = response_text
    if proposed_changes:
        import re
        display_content = re.sub(r"```json\s*\n\[[\s\S]*?\]\s*\n```", "", display_content).strip()
        display_content = re.sub(
            r"#+\s*Proposed Changes? (?:for\s+)?[^\n]+\s*\n+```\w*\n[\s\S]*?```",
            "",
            display_content,
            flags=re.IGNORECASE,
        ).strip()
        display_content = re.sub(r"\n*\d+ proposed changes?\s*$", "", display_content, flags=re.IGNORECASE).strip()

    assistant_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="assistant",
        content=display_content,
        proposed_changes=proposed_changes,
    )
    db.add(assistant_msg)
    await db.commit()
