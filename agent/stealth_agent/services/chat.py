"""Chat service — manages conversations with LLM context from feature requests and codebase."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import structlog

from stealth_agent.adapters.llm import LLMProvider
from stealth_agent.mappers import feature_request_from_row
from stealth_agent.models import AgentConversation, AgentJob, AgentMessage, FeatureRequestRow
from stealth_agent.services.change_parser import extract_proposed_changes
from stealth_agent.services.code_retriever import RetrievedChunk, find_github_connector_for_org, retrieve_relevant_chunks

log = structlog.get_logger()


async def get_or_create_conversation(
    db: AsyncSession,
    feature_request_id: str,
    organization_id: str,
) -> AgentConversation:
    fr_uuid = uuid.UUID(feature_request_id)
    org_uuid = uuid.UUID(organization_id)

    result = await db.execute(
        select(AgentConversation).where(
            AgentConversation.feature_request_id == fr_uuid,
            AgentConversation.organization_id == org_uuid,
        )
    )
    conversation = result.scalar_one_or_none()
    if conversation:
        return conversation

    conversation = AgentConversation(
        id=uuid.uuid4(),
        feature_request_id=fr_uuid,
        organization_id=org_uuid,
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
) -> list[AgentMessage]:
    result = await db.execute(
        select(AgentMessage)
        .where(AgentMessage.conversation_id == conversation_id)
        .order_by(AgentMessage.created_at)
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
    if job_result.get("proposed_files"):
        files_text = "\n".join(
            f"  - {f['file_path']}: {f.get('reason', '')}"
            for f in job_result["proposed_files"]
        )
        parts.append(f"Proposed files:\n{files_text}")

    return "\n".join(parts)


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
            chunks = await retrieve_relevant_chunks(
                query=user_message,
                connector_id=connector.id,
                organization_id=uuid.UUID(organization_id),
                top_k=8,
            )
            code_context = _format_code_context(chunks)
        except Exception as exc:
            log.warning("code_retrieval_failed", error=str(exc))

    # Get latest job result for continuity
    job_result = await _get_latest_job_result(db, feature_request_id, organization_id)
    job_context = _format_job_context(job_result)

    # Build system prompt
    system_parts = [
        "You are a codebase-aware engineering assistant."
    ]
    if repo_label:
        system_parts[0] += f" You have access to the repository code for {repo_label}."

    if fr_context:
        system_parts.append(fr_context)
    if code_context:
        system_parts.append(f"RELEVANT CODE (retrieved from the repository):\n{code_context}")
    if job_context:
        system_parts.append(f"LATEST AGENT RUN:\n{job_context}")

    system_parts.append(
        "Help the user understand the code, reason about implementation, and suggest precise changes.\n\n"
        "IMPORTANT FORMATTING RULES:\n"
        "1. First, write your explanation and reasoning in plain text.\n"
        "2. If you are proposing code changes, put them at the VERY END of your response as a JSON array inside a ```json block.\n"
        "3. Do NOT repeat or describe the JSON content in the prose — the UI will render the changes as interactive file cards automatically.\n"
        "4. Keep explanations concise and focused.\n\n"
        "JSON format for code changes:\n"
        '```json\n[{"file_path": "path/to/file.py", "content": "full file content...", "reason": "short reason"}]\n```'
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

    # Strip the raw JSON block from the display content when changes were extracted
    display_content = response_text
    if proposed_changes:
        import re
        display_content = re.sub(r"```json\s*\n\[[\s\S]*?\]\s*\n```", "", display_content).strip()
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
