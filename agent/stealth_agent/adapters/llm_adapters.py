"""LLM-backed implementations of agent adapter protocols."""

from __future__ import annotations

import json
import re
import uuid

import structlog

from stealth_agent.adapters.llm import LLMProvider
from stealth_agent.domain.models import (
    CodeChange,
    FeatureRequest,
    FeatureSpec,
    PrioritizedFeature,
    RepoAnalysis,
    TechnicalPlan,
)
from stealth_agent.services.code_retriever import retrieve_relevant_chunks
from stealth_agent.config import settings

log = structlog.get_logger()


class LLMSignalProcessor:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    async def prioritize_feature(self, request: FeatureRequest) -> PrioritizedFeature:
        evidence_text = "\n".join(
            f"- [{e.source_type.value}] {e.snippet} (weight={e.weight})"
            for e in request.evidence
        )
        system = (
            "You are a product prioritization expert. Analyze the feature request "
            "and return a JSON object with keys: name (string), rationale (string), "
            "priority_score (float 0-1)."
        )
        prompt = (
            f"Title: {request.title}\n"
            f"Problem: {request.problem_statement}\n"
            f"Evidence:\n{evidence_text}\n\n"
            "Return ONLY valid JSON."
        )
        raw = await self._llm.complete(
            system,
            [{"role": "user", "content": prompt}],
            max_tokens=settings.ANTHROPIC_PR_MAX_TOKENS,
        )
        data = _parse_json(raw)
        return PrioritizedFeature(
            name=data.get("name", request.title),
            rationale=data.get("rationale", ""),
            priority_score=float(data.get("priority_score", 0.5)),
        )


class LLMSpecPlanner:
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

    async def build_spec_and_plan(
        self,
        request: FeatureRequest,
        feature: PrioritizedFeature,
        repo_analysis: RepoAnalysis,
    ) -> tuple[FeatureSpec, TechnicalPlan]:
        system = (
            "You are a technical spec writer. Given a feature request and repo context, "
            "produce a JSON object with keys: summary (string), acceptance_criteria (list[str]), "
            "non_goals (list[str]), architecture_notes (string), tasks (list[str]), "
            "risk_notes (list[str])."
        )
        prompt = (
            f"Feature: {feature.name}\n"
            f"Problem: {request.problem_statement}\n"
            f"Repo language: {repo_analysis.primary_language}\n"
            f"Key paths: {', '.join(repo_analysis.key_paths[:5])}\n\n"
            "Return ONLY valid JSON."
        )
        raw = await self._llm.complete(system, [{"role": "user", "content": prompt}])
        data = _parse_json(raw)
        spec = FeatureSpec(
            summary=data.get("summary", ""),
            acceptance_criteria=data.get("acceptance_criteria", []),
            non_goals=data.get("non_goals", []),
        )
        plan = TechnicalPlan(
            architecture_notes=data.get("architecture_notes", ""),
            tasks=data.get("tasks", []),
            risk_notes=data.get("risk_notes", []),
        )
        return spec, plan


class LLMCodeGenerator:
    def __init__(
        self,
        llm: LLMProvider,
        *,
        connector_id: uuid.UUID | None = None,
        organization_id: str | None = None,
    ) -> None:
        self._llm = llm
        self._connector_id = connector_id
        self._organization_id = organization_id

    async def propose_changes(
        self,
        request: FeatureRequest,
        feature: PrioritizedFeature,
        spec: FeatureSpec,
        plan: TechnicalPlan,
        repo_analysis: RepoAnalysis,
    ) -> list[CodeChange]:
        system = (
            "You are a code generation assistant. Given a spec and plan, produce a JSON "
            "array of objects with keys: file_path (string), content (string), reason (string). "
            "Each object represents a file to create or modify. When relevant code context "
            "is provided, use it to make precise, well-integrated changes."
        )
        prompt_parts = [
            f"Feature: {feature.name}\n"
            f"Summary: {spec.summary}\n"
            f"Tasks: {json.dumps(plan.tasks)}\n"
            f"Repo language: {repo_analysis.primary_language}",
        ]

        # Add RAG context if connector is available and index may be ready
        code_context = ""
        if self._connector_id and self._organization_id:
            try:
                query = f"{feature.name}. {spec.summary}. Tasks: {' '.join(plan.tasks)}"
                reduce_context = (
                    len(plan.tasks) > 8
                    or len(spec.summary) > 500
                    or repo_analysis.primary_language == "unknown"
                )
                top_k = (
                    settings.RAG_TOP_K_REDUCED
                    if reduce_context
                    else settings.RAG_TOP_K_DEFAULT
                )
                chunks = await retrieve_relevant_chunks(
                    query,
                    self._connector_id,
                    uuid.UUID(self._organization_id),
                    top_k=top_k,
                )
                if chunks:
                    max_chunk_chars = settings.RAG_MAX_CHARS_PER_CHUNK
                    max_total_chars = settings.RAG_MAX_TOTAL_CHARS
                    total_chars = 0
                    trimmed_chunks = []
                    for c in chunks:
                        content = c.content[:max_chunk_chars]
                        total_chars += len(content)
                        if total_chars > max_total_chars:
                            break
                        trimmed_chunks.append(
                            f"--- {c.file_path} (lines {c.start_line}-{c.end_line}) ---\n{content}"
                        )
                    code_context = "\n\n".join(
                        trimmed_chunks
                    )
                    prompt_parts.append(
                        f"RELEVANT CODE FROM REPOSITORY (use for context when modifying):\n{code_context}"
                    )
            except Exception as exc:
                log.debug(
                    "rag_retrieval_skipped",
                    connector_id=str(self._connector_id),
                    error=str(exc),
                )

        prompt_parts.append("\nReturn ONLY a valid JSON array.")
        prompt = "\n\n".join(prompt_parts)

        raw = await self._llm.complete(system, [{"role": "user", "content": prompt}])
        items = _parse_json(raw)
        if isinstance(items, dict):
            items = [items]
        return [
            CodeChange(
                file_path=item.get("file_path", "unknown"),
                content=item.get("content", ""),
                reason=item.get("reason", ""),
            )
            for item in items
        ]


def _extract_json(text: str) -> str:
    """Extract JSON from LLM output, stripping markdown fences if present."""
    text = text.strip()

    # Find ```json ... ``` or ``` ... ``` blocks anywhere in the text
    fence_match = re.search(r"```(?:json)?\s*\n([\s\S]*?)```", text)
    if fence_match:
        return fence_match.group(1).strip()

    # Legacy: if the whole response starts with ```
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1
        end = len(lines)
        for i in range(1, len(lines)):
            if lines[i].strip() == "```":
                end = i
                break
        return "\n".join(lines[start:end])

    return text


def _parse_json(text: str) -> dict | list:
    """Parse JSON from LLM output, attempting repair if truncated."""
    log = structlog.get_logger()

    # First try: extract from fenced blocks
    extracted = _extract_json(text)
    try:
        return json.loads(extracted)
    except json.JSONDecodeError:
        pass

    # Second try: look for the largest fenced block (LLMs sometimes have multiple)
    all_fences = re.findall(r"```(?:json)?\s*\n([\s\S]*?)```", text)
    for block in sorted(all_fences, key=len, reverse=True):
        try:
            return json.loads(block.strip())
        except json.JSONDecodeError:
            continue

    # Third try: find a raw JSON array or object in the text
    for pattern in [r"\[\s*\{[\s\S]*\}\s*\]", r"\{[\s\S]*\}"]:
        match = re.search(pattern, text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                candidate = match.group()
                for repair in ('"', '"}', '"}]', '"]', "}]", "}", "]"):
                    try:
                        return json.loads(candidate + repair)
                    except json.JSONDecodeError:
                        continue

    # Fourth try: find the first [ or { and try to parse from there
    start_match = re.search(r"[\[{]", extracted)
    if start_match:
        remainder = extracted[start_match.start():]
        for repair in ("", '"', '"}', '"}]', '"]', "}]", "}", "]"):
            try:
                return json.loads(remainder + repair)
            except json.JSONDecodeError:
                continue

    log.error("json_parse_failed", text_preview=text[:500], text_length=len(text))
    raise json.JSONDecodeError(
        f"Could not parse or repair LLM JSON (length={len(text)})",
        text[:200],
        0,
    )
