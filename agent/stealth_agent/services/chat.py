"""Chat service — manages conversations with LLM context from feature requests and codebase."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from stealth_agent.adapters.github_repo import GitHubRepoFetcher
from stealth_agent.adapters.llm import LLMProvider
from stealth_agent.mappers import feature_request_from_row
from stealth_agent.models import AgentConversation, AgentJob, AgentMessage, ConnectorRow, FeatureRequestRow
from stealth_agent.services.change_parser import extract_proposed_changes
from stealth_agent.services.chat_tools import TOOL_SCHEMAS, ToolExecutor
from stealth_agent.services.code_retriever import RetrievedChunk, find_github_connector_for_org, retrieve_relevant_chunks

log = structlog.get_logger()

MAX_TOOL_ROUNDS = 10


@dataclass
class StreamEvent:
    """An event yielded from the agentic chat stream."""
    type: str  # "token", "status", "done", "error"
    content: str = ""


INTENT_SYSTEM_PROMPT = (
    "Classify the user's message intent. Reply with EXACTLY one word:\n"
    "  CHANGE — if the user is requesting a code modification, bug fix, feature implementation, "
    "refactoring, addition, removal, or update to any file.\n"
    "  QUESTION — if the user is asking a question, requesting an explanation, asking to show/display "
    "something, or anything that is NOT a code change request.\n"
    "Reply with only the single word CHANGE or QUESTION, nothing else."
)


async def classify_intent(llm: LLMProvider, message: str) -> str:
    """Classify user message as 'change' or 'question' using a fast LLM call."""
    try:
        result = await llm.complete(
            INTENT_SYSTEM_PROMPT,
            [{"role": "user", "content": message}],
            max_tokens=4,
        )
        word = result.strip().upper()
        if "CHANGE" in word:
            return "change"
        return "question"
    except Exception:
        log.warning("intent_classification_failed", message=message[:100])
        return "question"


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


def _format_job_context(job_result: dict | None, *, lightweight: bool = False) -> str:
    """Format job context for the LLM system prompt.

    When lightweight=True (agentic path), only includes file paths
    so the LLM uses tools to fetch content on demand.
    """
    if not job_result:
        return ""

    parts = []
    if job_result.get("spec_summary"):
        parts.append(f"Summary: {job_result['spec_summary']}")
    if job_result.get("tasks"):
        parts.append("Tasks:\n" + "\n".join(f"  - {t}" for t in job_result["tasks"]))

    proposed = job_result.get("proposed_files") or []
    if proposed:
        if lightweight:
            file_list = "\n".join(f"  - {f.get('file_path', '')}" for f in proposed)
            parts.append(
                f"FILES IN CURRENT PR ({len(proposed)} files):\n{file_list}\n"
                "Use read_file to fetch any file you need to inspect or modify."
            )
        else:
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


AGENTIC_CHANGE_INSTRUCTIONS = (
    "The user is requesting a CODE CHANGE. You have tools to explore the codebase.\n"
    "Workflow:\n"
    "1. Use read_file to fetch ONLY the file(s) you need to change.\n"
    "2. Briefly explain your approach in plain text.\n"
    "3. Output changes at the VERY END as a JSON array inside a ```json block.\n"
    "4. Use SEARCH/REPLACE blocks — NOT the full file. Keep diffs minimal.\n\n"
    "JSON format (one object per file):\n"
    '```json\n[\n  {\n    "file_path": "path/to/file.css",\n'
    '    "search_replace": [\n'
    '      {"search": "exact lines to find", "replace": "replacement lines"}\n'
    "    ],\n"
    '    "reason": "short reason"\n'
    "  }\n]\n```\n\n"
    "Rules:\n"
    "- `search` must be a verbatim substring of the current file (copy from read_file output).\n"
    "- `search` should include enough surrounding lines to be unique in the file.\n"
    "- `replace` is what replaces the matched text.\n"
    "- For new files, use `content` (full text) instead of `search_replace`.\n"
    "- NEVER output full file contents for existing files — only the changed regions."
)

CONVERSATION_SUMMARY_PROMPT = (
    "Summarize the conversation so far into a concise context block (max 500 words). "
    "Focus on:\n"
    "- What feature/PR is being worked on\n"
    "- Key decisions and changes already made\n"
    "- File paths that were discussed or modified\n"
    "- Any constraints or preferences the user expressed\n\n"
    "Write in third person, past tense. Be specific about file paths and changes. "
    "Do NOT include code blocks or JSON."
)

MAX_RECENT_MESSAGES = 6
MAX_HISTORY_TOKENS_ESTIMATE = 4000


async def _build_condensed_history(
    llm: LLMProvider,
    all_messages: list[AgentMessage],
) -> list[dict[str, str]]:
    """Build a condensed message list: summary of old messages + recent verbatim.

    If the conversation is short enough, returns all messages as-is.
    Otherwise, summarizes older messages and keeps the last MAX_RECENT_MESSAGES.
    """
    msgs = [m for m in all_messages if m.role != "system"]

    if len(msgs) <= MAX_RECENT_MESSAGES:
        return [{"role": m.role, "content": m.content} for m in msgs]

    # Rough token estimate: 1 token ≈ 4 chars
    total_chars = sum(len(m.content) for m in msgs)
    if total_chars / 4 < MAX_HISTORY_TOKENS_ESTIMATE:
        return [{"role": m.role, "content": m.content} for m in msgs]

    # Split into old (to summarize) and recent (to keep verbatim)
    old_msgs = msgs[:-MAX_RECENT_MESSAGES]
    recent_msgs = msgs[-MAX_RECENT_MESSAGES:]

    # Build a text representation of old messages for summarization
    old_text_parts = []
    for m in old_msgs:
        # Truncate very long messages (e.g. assistant responses with full file contents)
        content = m.content
        if len(content) > 800:
            content = content[:400] + "\n...[truncated]...\n" + content[-200:]
        old_text_parts.append(f"[{m.role}]: {content}")
    old_text = "\n\n".join(old_text_parts)

    try:
        summary = await llm.complete(
            CONVERSATION_SUMMARY_PROMPT,
            [{"role": "user", "content": old_text}],
            max_tokens=600,
        )
        summary = summary.strip()
    except Exception:
        log.warning("conversation_summary_failed", msg_count=len(old_msgs))
        # Fallback: just take the last messages
        return [{"role": m.role, "content": m.content} for m in recent_msgs]

    condensed: list[dict[str, str]] = [
        {"role": "user", "content": f"[Previous conversation summary]\n{summary}"},
        {"role": "assistant", "content": "Understood. I have the context from our previous conversation."},
    ]
    for m in recent_msgs:
        condensed.append({"role": m.role, "content": m.content})

    log.info(
        "conversation_condensed",
        original_count=len(msgs),
        old_summarized=len(old_msgs),
        recent_kept=len(recent_msgs),
        summary_len=len(summary),
    )
    return condensed


async def _build_tool_executor(
    db: AsyncSession,
    organization_id: str,
    feature_request_id: str,
) -> tuple[ToolExecutor | None, str]:
    """Create a ToolExecutor if a GitHub connector + branch are available.
    Returns (executor_or_None, branch_name)."""
    connector = await find_github_connector_for_org(organization_id)
    if not connector:
        return None, ""

    config = connector.config or {}
    creds = connector.credentials or {}
    gh_token = creds.get("access_token", "")
    gh_repo = config.get("repository", "")
    if not gh_token or not gh_repo or "/" not in gh_repo:
        return None, ""

    owner, repo_name = gh_repo.split("/", 1)

    # Determine the PR branch
    branch = ""
    job_result = await _get_latest_job_result(db, feature_request_id, organization_id)
    if job_result:
        branch = job_result.get("branch_name", "")
        if not branch:
            pr_url = job_result.get("pull_request_url", "")
            if pr_url:
                from stealth_agent.services.apply_changes import _fetch_branch_from_pr_url
                branch = await _fetch_branch_from_pr_url(pr_url, gh_token) or ""

    fetcher = GitHubRepoFetcher(token=gh_token, owner=owner, repo=repo_name)
    executor = ToolExecutor(
        fetcher=fetcher,
        connector_id=connector.id,
        organization_id=uuid.UUID(organization_id),
        branch=branch or None,
    )
    return executor, branch


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

    # Classify user intent
    intent = await classify_intent(llm, user_message)
    log.info("chat_intent", intent=intent, message=user_message[:80])

    if intent == "change":
        system_parts.append(
            "The user is requesting a CODE CHANGE. You MUST:\n"
            "1. Briefly explain your approach in plain text.\n"
            "2. Output ALL changed files at the VERY END as a JSON array inside a ```json block.\n"
            "3. Do NOT put file contents in ```css, ```js, or other code blocks — ONLY in the JSON.\n"
            "4. The UI renders each file as a collapsible Apply-to-PR card.\n\n"
            "JSON format (one object per file):\n"
            '```json\n[{"file_path": "path/to/file.css", "content": "full file content...", "reason": "short reason"}]\n```'
        )
    else:
        system_parts.append(
            "Help the user understand the code, reason about implementation, and answer their question.\n"
            "Use plain markdown and code blocks for explanations. Do NOT output a proposed_changes JSON block — "
            "the user is asking a question, not requesting a code change."
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
    proposed_changes = extract_proposed_changes(response_text, intent=intent)

    # Strip change blocks from display content when extracted
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
) -> AsyncIterator[StreamEvent]:
    """Stream chat response as StreamEvents. For change intents, uses the
    agentic tool-use loop; for questions, uses a simple text stream."""

    # Classify user intent
    intent = await classify_intent(llm, user_message)
    log.info("chat_stream_intent", intent=intent, message=user_message[:80])

    if intent == "change":
        async for event in chat_stream_agentic(
            db, llm, feature_request_id, organization_id, user_message
        ):
            yield event
        return

    # --- Question path: simple text stream (unchanged) ---
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
        "Help the user understand the code, reason about implementation, and answer their question.\n"
        "Use plain markdown and code blocks for explanations. Do NOT output a proposed_changes JSON block — "
        "the user is asking a question, not requesting a code change."
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
    llm_messages = await _build_condensed_history(llm, all_messages)

    full_response = []
    async for token in llm.stream(system, llm_messages):
        full_response.append(token)
        yield StreamEvent(type="token", content=token)

    response_text = "".join(full_response)

    assistant_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="assistant",
        content=response_text,
        proposed_changes=None,
    )
    db.add(assistant_msg)
    await db.commit()


async def chat_stream_agentic(
    db: AsyncSession,
    llm: LLMProvider,
    feature_request_id: str,
    organization_id: str,
    user_message: str,
) -> AsyncIterator[StreamEvent]:
    """Agentic tool-use loop for code change requests.

    The LLM iteratively calls tools (read_file, search_code, list_files) to
    gather context, then emits its final answer with proposed changes.
    Yields StreamEvent objects so the route can multiplex tokens vs status.
    """

    # ---- Context gathering (same as question path) ----
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

    job_result = await _get_latest_job_result(db, feature_request_id, organization_id)
    job_context = _format_job_context(job_result, lightweight=True)

    connector = await find_github_connector_for_org(organization_id)
    repo_label = ""
    if connector:
        config = connector.config or {}
        repo_label = config.get("repository", "")

    # Build system prompt — lean: no full file contents, LLM uses tools instead
    system_parts = [
        "You are a codebase-aware engineering assistant with access to the user's repository."
    ]
    if repo_label:
        system_parts[0] += f" The linked repo is {repo_label}."
    system_parts[0] += (
        " You have tools to read files, search code, and list the project structure. "
        "Use them to gather context before proposing changes."
    )

    if fr_context:
        system_parts.append(fr_context)
    if job_context:
        system_parts.append(job_context)

    system_parts.append(AGENTIC_CHANGE_INSTRUCTIONS)
    system = "\n\n".join(system_parts)

    # ---- Build tool executor ----
    tool_executor, branch = await _build_tool_executor(db, organization_id, feature_request_id)

    # ---- Save user message ----
    conversation = await get_or_create_conversation(db, feature_request_id, organization_id)
    user_msg = AgentMessage(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    await db.flush()

    # Build condensed conversation history
    all_messages = await get_conversation_messages(db, conversation.id)
    llm_messages: list[dict[str, Any]] = await _build_condensed_history(llm, all_messages)

    # If no tool executor (no GitHub connector), fall back to streaming without tools
    if tool_executor is None:
        log.info("agentic_no_tools_fallback", feature_request_id=feature_request_id)
        full_response = []
        async for token in llm.stream(system, llm_messages):
            full_response.append(token)
            yield StreamEvent(type="token", content=token)
        response_text = "".join(full_response)
        proposed_changes = extract_proposed_changes(response_text, intent="change")
        display_content = _strip_change_blocks(response_text, proposed_changes)
        assistant_msg = AgentMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            role="assistant",
            content=display_content,
            proposed_changes=proposed_changes,
        )
        db.add(assistant_msg)
        await db.commit()
        return

    # ---- Agentic tool-use loop ----
    all_text_parts: list[str] = []
    try:
        for round_num in range(MAX_TOOL_ROUNDS):
            log.info("agentic_round", round=round_num, message_count=len(llm_messages))

            if not hasattr(llm, "stream_with_tools"):
                log.warning("llm_missing_stream_tool_support")
                break

            round_text_parts: list[str] = []
            tool_calls: list[dict] = []
            stop_reason = "end_turn"
            response_obj = None

            async for event in llm.stream_with_tools(
                system=system,
                messages=llm_messages,
                tools=TOOL_SCHEMAS,
            ):
                if event["type"] == "text_delta":
                    chunk = event["text"]
                    round_text_parts.append(chunk)
                    yield StreamEvent(type="token", content=chunk)
                elif event["type"] == "tool_use":
                    tool_calls.append(event)
                elif event["type"] == "message_done":
                    stop_reason = event["stop_reason"]
                    response_obj = event["response"]

            combined_text = "".join(round_text_parts)
            if combined_text:
                all_text_parts.append(combined_text)

            if stop_reason != "tool_use" or not tool_calls:
                break

            # Append assistant message (with tool_use blocks) to LLM context
            if response_obj:
                llm_messages.append({
                    "role": "assistant",
                    "content": [
                        {"type": getattr(b, "type", "text"), **(
                            {"text": b.text} if getattr(b, "type", "") == "text"
                            else {"id": b.id, "name": b.name, "input": b.input}
                        )}
                        for b in response_obj.content
                    ],
                })

            tool_results = []
            for tc in tool_calls:
                tool_name = tc["name"]
                tool_input = tc.get("input", {})

                status_msg = tool_executor.status_message(tool_name, tool_input)
                yield StreamEvent(type="status", content=status_msg)

                result_text = await tool_executor.execute(tool_name, tool_input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tc["id"],
                    "content": result_text,
                })

                log.info(
                    "tool_executed",
                    tool=tool_name,
                    input=str(tool_input)[:200],
                    result_len=len(result_text),
                    round=round_num,
                )

            llm_messages.append({"role": "user", "content": tool_results})
        else:
            log.warning("agentic_max_rounds_reached", rounds=MAX_TOOL_ROUNDS)

        # ---- Persist final response ----
        response_text = "".join(all_text_parts)
        proposed_changes = extract_proposed_changes(response_text, intent="change")
        display_content = _strip_change_blocks(response_text, proposed_changes)

        assistant_msg = AgentMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            role="assistant",
            content=display_content,
            proposed_changes=proposed_changes,
        )
        db.add(assistant_msg)
        await db.commit()

    finally:
        if tool_executor and hasattr(tool_executor, "_fetcher"):
            await tool_executor._fetcher.close()


def _strip_change_blocks(text: str, proposed_changes: list[dict] | None) -> str:
    """Remove raw JSON change blocks from the display text when they were parsed."""
    if not proposed_changes:
        return text

    import re
    result = re.sub(r"```json\s*\n\[[\s\S]*?\]\s*\n```", "", text).strip()
    result = re.sub(
        r"#+\s*Proposed Changes? (?:for\s+)?[^\n]+\s*\n+```\w*\n[\s\S]*?```",
        "",
        result,
        flags=re.IGNORECASE,
    ).strip()
    result = re.sub(r"\n*\d+ proposed changes?\s*$", "", result, flags=re.IGNORECASE).strip()
    return result
