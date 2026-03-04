"""LLM-backed implementations of agent adapter protocols."""

from __future__ import annotations

import json
import re

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
        raw = await self._llm.complete(system, [{"role": "user", "content": prompt}])
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
    def __init__(self, llm: LLMProvider) -> None:
        self._llm = llm

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
            "Each object represents a file to create or modify."
        )
        prompt = (
            f"Feature: {feature.name}\n"
            f"Summary: {spec.summary}\n"
            f"Tasks: {json.dumps(plan.tasks)}\n"
            f"Repo language: {repo_analysis.primary_language}\n\n"
            "Return ONLY a valid JSON array."
        )
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
    if text.startswith("```"):
        lines = text.split("\n")
        start = 1
        end = len(lines)
        for i in range(1, len(lines)):
            if lines[i].strip() == "```":
                end = i
                break
        text = "\n".join(lines[start:end])
    return text


def _parse_json(text: str) -> dict | list:
    """Parse JSON from LLM output, attempting repair if truncated."""
    extracted = _extract_json(text)
    try:
        return json.loads(extracted)
    except json.JSONDecodeError:
        pass

    # Try to find the outermost JSON structure with a regex
    match = re.search(r"[\[{]", extracted)
    if match:
        extracted = extracted[match.start():]

    # Attempt to repair truncated JSON by closing open brackets/braces
    for repair in ("", '"', '"}', '"}]', '"]', "}]", "}", "]"):
        try:
            return json.loads(extracted + repair)
        except json.JSONDecodeError:
            continue

    raise json.JSONDecodeError(
        f"Could not parse or repair LLM JSON (length={len(text)})",
        text[:200],
        0,
    )
