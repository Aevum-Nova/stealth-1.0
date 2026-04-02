from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta, UTC
from typing import Any
from uuid import UUID

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import async_session
from src.models.connector import Connector
from src.models.feature_request import FeatureRequest, FeatureRequestSignal, SynthesisRun
from src.models.signal import Signal
from src.models.trigger import EventBuffer, IngestedEvent, Trigger
from src.services.triggers import trigger_service

logger = structlog.get_logger(__name__)

MAX_TOOL_ROUNDS = 5
_MAX_DETAIL_TEXT = 8000

TOOL_SCHEMAS: list[dict] = [
    {
        "name": "get_triggers",
        "description": (
            "Get all triggers for the organization with their stats, scope, and status. "
            "Use this to understand what data is currently being captured and monitored. "
            "Returns trigger descriptions, scopes, and activity metrics."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["active", "paused", "error"],
                    "description": "Filter by trigger status. Leave empty for all triggers.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_trigger_detail",
        "description": (
            "Get detailed information about a specific trigger including its configuration, "
            "recent events, and buffer status. Use when you need deep dive into a specific trigger."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "trigger_id": {
                    "type": "string",
                    "description": "UUID of the trigger to get details for.",
                },
            },
            "required": ["trigger_id"],
        },
    },
    {
        "name": "get_feature_requests",
        "description": (
            "List feature requests with optional filters. Returns id, title, status, priority, and short summaries. "
            "When the user compares code/PR size across MULTIPLE requests, call compare_feature_requests_code once with those ids — "
            "do not call get_feature_request_detail repeatedly. Use get_feature_request_detail only for deep dive on a single id "
            "(full spec, evidence, signals). Feature requests are synthesized from customer signals."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Filter by status: draft, reviewed, approved, rejected, merged, sent_to_agent. Leave empty for all.",
                },
                "priority": {
                    "type": "string",
                    "description": "Filter by priority: low, medium, high, critical. Leave empty for all.",
                },
                "title_contains": {
                    "type": "string",
                    "description": "Case-insensitive substring match on title (e.g. user mentions part of a request name).",
                },
                "limit": {
                    "type": "integer",
                    "default": 20,
                    "description": "Maximum number of results to return.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_feature_request_detail",
        "description": (
            "Full detail for ONE feature request by UUID: problem/solution, user story, acceptance criteria, "
            "technical notes, synthesis metadata, linked customer signals, and (with session JWT) agent jobs + PR + file list. "
            "For comparing code/PR metrics across several requests, use compare_feature_requests_code instead of calling this tool multiple times."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "feature_request_id": {
                    "type": "string",
                    "description": "UUID of the feature request (from list results or the app URL).",
                },
                "include_linked_signals": {
                    "type": "boolean",
                    "default": True,
                    "description": "Include linked signals with summaries and quotes.",
                },
                "include_agent_code_status": {
                    "type": "boolean",
                    "default": True,
                    "description": "Include agent jobs, PR status, and PR file list (requires agent service + user JWT).",
                },
                "signal_limit": {
                    "type": "integer",
                    "default": 20,
                    "description": "Max linked signals to return.",
                },
            },
            "required": ["feature_request_id"],
        },
    },
    {
        "name": "compare_feature_requests_code",
        "description": (
            "Compare PR/code impact for many feature requests in one efficient call. "
            "Pass UUIDs from get_feature_requests. Returns per-request PR URL/state, file count, total additions/deletions, "
            "and top changed files — results sorted by additions (largest first). "
            "Use whenever the user asks which request has the most code changes, to rank PRs, or to compare implementation size across open requests."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "feature_request_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of feature request UUIDs to compare (max 20).",
                },
            },
            "required": ["feature_request_ids"],
        },
    },
    {
        "name": "get_signal_stats",
        "description": (
            "Get aggregated signal metrics and breakdown by source. "
            "Use this to understand data volume, source distribution, and trends. "
            "Signals are raw customer feedback/data points captured from connectors."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": ["7d", "30d", "90d"],
                    "default": "30d",
                    "description": "Time period for stats: last 7 days, 30 days, or 90 days.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_connectors",
        "description": (
            "Get all connected data sources and their status. "
            "Use this to see what integrations are configured and active. "
            "Connectors are the data sources (Slack, Zendesk, etc.) that feed signals."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_dashboard_stats",
        "description": (
            "Get high-level dashboard metrics. Use this for quick overview of total signals, "
            "feature requests, active connectors, and synthesis status."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


def _clip_text(value: str | None, max_len: int = _MAX_DETAIL_TEXT) -> str:
    if not value:
        return ""
    if len(value) <= max_len:
        return value
    return value[: max_len - 3] + "..."


def _as_bool(val: Any, default: bool = True) -> bool:
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes")
    return bool(val)


class PlatformToolExecutor:
    def __init__(
        self,
        db: AsyncSession,
        org_id: str,
        *,
        agent_bearer_token: str | None = None,
    ) -> None:
        self._db = db
        self._org_id = org_id
        self._agent_token = agent_bearer_token

    _AGENT_NOTE = (
        "Agent data unavailable (set AGENT_SERVICE_URL and use a user session JWT, not an API key only)."
    )

    def _agent_base_url(self) -> str | None:
        base = (settings.AGENT_SERVICE_URL or "").strip().rstrip("/")
        if not base or not self._agent_token:
            return None
        return base

    async def _agent_request(self, client: httpx.AsyncClient, base: str, path: str) -> Any:
        url = f"{base}/api/v1{path}"
        try:
            r = await client.get(
                url,
                headers={"Authorization": f"Bearer {self._agent_token}"},
            )
            if r.status_code >= 400:
                return {
                    "_http_status": r.status_code,
                    "_error": r.text[:800],
                }
            body = r.json()
            return body.get("data", body)
        except Exception as exc:
            logger.warning("agent_proxy_error", path=path, error=str(exc))
            return {"_fetch_error": str(exc)}

    async def _agent_get_json(self, path: str) -> Any:
        """GET agent API path (e.g. /feature-requests/{id}/jobs). Returns parsed JSON or error dict."""
        base = self._agent_base_url()
        if not base:
            return {"_note": self._AGENT_NOTE}
        async with httpx.AsyncClient(timeout=25.0) as client:
            return await self._agent_request(client, base, path)

    @staticmethod
    def _aggregate_pr_files_payload(files_raw: Any) -> dict[str, Any]:
        if not isinstance(files_raw, dict):
            return {
                "pull_request_url": None,
                "file_count": 0,
                "total_additions": 0,
                "total_deletions": 0,
                "top_files": [],
                "_raw_error": str(files_raw)[:300],
            }
        if files_raw.get("_http_status") or files_raw.get("_fetch_error"):
            return {
                "pull_request_url": None,
                "file_count": 0,
                "total_additions": 0,
                "total_deletions": 0,
                "top_files": [],
                "_agent_error": files_raw,
            }
        files = files_raw.get("files") or []
        if not isinstance(files, list):
            files = []
        total_add = 0
        total_del = 0
        norm: list[dict[str, Any]] = []
        for f in files:
            if not isinstance(f, dict):
                continue
            a = int(f.get("additions") or 0)
            d = int(f.get("deletions") or 0)
            total_add += a
            total_del += d
            norm.append(
                {
                    "filename": f.get("filename", ""),
                    "status": f.get("status", ""),
                    "additions": a,
                    "deletions": d,
                }
            )
        norm.sort(key=lambda x: x["additions"] + x["deletions"], reverse=True)
        return {
            "pull_request_url": files_raw.get("pull_request_url"),
            "file_count": len(norm),
            "total_additions": total_add,
            "total_deletions": total_del,
            "top_files": norm[:12],
        }

    async def execute(self, tool_name: str, tool_input: dict) -> str:
        try:
            if tool_name == "get_triggers":
                return await self._get_triggers(tool_input.get("status"))
            elif tool_name == "get_trigger_detail":
                return await self._get_trigger_detail(tool_input.get("trigger_id"))
            elif tool_name == "get_feature_requests":
                return await self._get_feature_requests(
                    tool_input.get("status"),
                    tool_input.get("priority"),
                    tool_input.get("limit", 20),
                    tool_input.get("title_contains"),
                )
            elif tool_name == "get_feature_request_detail":
                return await self._get_feature_request_detail(
                    tool_input.get("feature_request_id"),
                    _as_bool(tool_input.get("include_linked_signals"), True),
                    _as_bool(tool_input.get("include_agent_code_status"), True),
                    int(tool_input.get("signal_limit") or 20),
                )
            elif tool_name == "compare_feature_requests_code":
                return await self._compare_feature_requests_code(
                    tool_input.get("feature_request_ids"),
                )
            elif tool_name == "get_signal_stats":
                return await self._get_signal_stats(tool_input.get("period", "30d"))
            elif tool_name == "get_connectors":
                return await self._get_connectors()
            elif tool_name == "get_dashboard_stats":
                return await self._get_dashboard_stats()
            else:
                return f"Unknown tool: {tool_name}"
        except Exception as exc:
            logger.warning("tool_execution_error", tool=tool_name, error=str(exc))
            return f"Error executing {tool_name}: {exc}"

    def status_message(self, tool_name: str, tool_input: dict) -> str:
        messages = {
            "get_triggers": "Getting your triggers...",
            "get_trigger_detail": "Getting trigger details...",
            "get_feature_requests": "Fetching feature requests...",
            "get_feature_request_detail": "Loading feature request details...",
            "compare_feature_requests_code": "Comparing code across feature requests...",
            "get_signal_stats": "Calculating signal statistics...",
            "get_connectors": "Checking your connectors...",
            "get_dashboard_stats": "Loading dashboard stats...",
        }
        return messages.get(tool_name, f"Running {tool_name}...")

    async def _get_triggers(self, status: str | None = None) -> str:
        org_uuid = UUID(self._org_id)
        query = (
            select(Trigger, Connector)
            .join(Connector, Connector.id == Trigger.connector_id)
            .where(Trigger.organization_id == org_uuid)
        )
        if status:
            query = query.where(Trigger.status == status)
        query = query.order_by(Trigger.created_at.desc())

        result = await self._db.execute(query)
        pairs = list(result.all())

        if not pairs:
            return "No triggers found for your organization."

        trigger_ids = [t.id for t, _ in pairs]
        stats = await self._load_trigger_stats(trigger_ids)

        triggers_data = []
        for trigger, connector in pairs:
            stat = stats.get(trigger.id, {})
            triggers_data.append(
                {
                    "id": str(trigger.id),
                    "name": trigger.natural_language_description[:100],
                    "scope_summary": trigger.scope_summary,
                    "status": trigger.status,
                    "connector": connector.name,
                    "created_at": trigger.created_at.isoformat() if trigger.created_at else None,
                    "last_event_at": trigger.last_event_at.isoformat()
                    if trigger.last_event_at
                    else None,
                    "matched_events_24h": stat.get("matched_events_24h", 0),
                    "feature_requests_created": stat.get("feature_request_count", 0),
                }
            )

        return json.dumps({"triggers": triggers_data, "total": len(triggers_data)}, indent=2)

    async def _get_trigger_detail(self, trigger_id: str | None) -> str:
        if not trigger_id:
            return "Error: trigger_id is required."

        try:
            tid = UUID(trigger_id)
        except ValueError:
            return f"Error: invalid trigger_id format."

        detail = await trigger_service.get_trigger_detail(self._db, self._org_id, tid)
        if not detail:
            return f"Trigger not found: {trigger_id}"

        t = detail.trigger
        data = {
            "id": str(t.id),
            "description": t.natural_language_description,
            "scope_summary": t.scope_summary,
            "status": t.status,
            "connector": {"name": t.connector.name, "type": t.connector.type},
            "buffer_config": t.buffer_config.model_dump() if t.buffer_config else {},
            "match_config": t.match_config.model_dump() if t.match_config else {},
            "stats": t.stats.model_dump() if t.stats else {},
            "last_event_at": t.last_event_at.isoformat() if t.last_event_at else None,
            "last_dispatch_at": t.last_dispatch_at.isoformat() if t.last_dispatch_at else None,
            "last_error": t.last_error,
            "recent_events": [
                {
                    "id": str(e.id),
                    "content": e.content_text[:200] if e.content_text else "",
                    "status": e.processing_status,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in detail.recent_events[:10]
            ],
        }
        return json.dumps(data, indent=2)

    async def _get_feature_requests(
        self,
        status: str | None = None,
        priority: str | None = None,
        limit: int = 20,
        title_contains: str | None = None,
    ) -> str:
        org_uuid = UUID(self._org_id)
        query = select(FeatureRequest).where(FeatureRequest.organization_id == org_uuid)

        if status:
            query = query.where(FeatureRequest.status == status)
        if priority:
            query = query.where(FeatureRequest.priority == priority)
        if title_contains and title_contains.strip():
            query = query.where(FeatureRequest.title.ilike(f"%{title_contains.strip()}%"))

        query = query.order_by(FeatureRequest.priority_score.desc()).limit(limit)

        result = await self._db.execute(query)
        frs = list(result.scalars().all())

        if not frs:
            return "No feature requests found matching your criteria."

        data = {
            "feature_requests": [
                {
                    "id": str(fr.id),
                    "title": fr.title,
                    "type": fr.type,
                    "status": fr.status,
                    "priority": fr.priority,
                    "priority_score": fr.priority_score,
                    "problem_statement": fr.problem_statement[:200] if fr.problem_statement else "",
                    "created_at": fr.created_at.isoformat() if fr.created_at else None,
                    "synthesis_confidence": fr.synthesis_confidence,
                }
                for fr in frs
            ],
            "total": len(frs),
        }
        return json.dumps(data, indent=2)

    async def _get_feature_request_detail(
        self,
        feature_request_id: str | None,
        include_linked_signals: bool,
        include_agent_code_status: bool,
        signal_limit: int,
    ) -> str:
        if not feature_request_id:
            return "Error: feature_request_id is required."

        try:
            fr_uuid = UUID(feature_request_id.strip())
        except ValueError:
            return "Error: feature_request_id must be a valid UUID."

        org_uuid = UUID(self._org_id)
        result = await self._db.execute(
            select(FeatureRequest).where(
                FeatureRequest.id == fr_uuid,
                FeatureRequest.organization_id == org_uuid,
            )
        )
        fr = result.scalar_one_or_none()
        if not fr:
            return f"Feature request not found: {feature_request_id}"

        data: dict[str, Any] = {
            "id": str(fr.id),
            "title": fr.title,
            "type": fr.type,
            "status": fr.status,
            "priority": fr.priority,
            "priority_score": fr.priority_score,
            "problem_statement": _clip_text(fr.problem_statement),
            "proposed_solution": _clip_text(fr.proposed_solution),
            "user_story": _clip_text(fr.user_story),
            "acceptance_criteria": fr.acceptance_criteria or [],
            "technical_notes": _clip_text(fr.technical_notes),
            "affected_product_areas": fr.affected_product_areas or [],
            "supporting_evidence": fr.supporting_evidence or [],
            "impact_metrics": fr.impact_metrics,
            "synthesis_run_id": str(fr.synthesis_run_id) if fr.synthesis_run_id else None,
            "synthesis_model": fr.synthesis_model,
            "synthesis_confidence": fr.synthesis_confidence,
            "synthesis_summary": _clip_text(fr.synthesis_summary, 4000),
            "merged_into_id": str(fr.merged_into_id) if fr.merged_into_id else None,
            "human_edited": fr.human_edited,
            "human_edited_fields": fr.human_edited_fields or [],
            "human_notes": _clip_text(fr.human_notes),
            "created_at": fr.created_at.isoformat() if fr.created_at else None,
            "updated_at": fr.updated_at.isoformat() if fr.updated_at else None,
        }

        if fr.synthesis_run_id:
            run_r = await self._db.execute(
                select(SynthesisRun).where(SynthesisRun.id == fr.synthesis_run_id)
            )
            run = run_r.scalar_one_or_none()
            if run:
                data["synthesis_run"] = {
                    "id": str(run.id),
                    "status": run.status,
                    "signal_count": run.signal_count,
                    "cluster_count": run.cluster_count,
                    "feature_request_count": run.feature_request_count,
                    "error": run.error,
                    "started_at": run.started_at.isoformat() if run.started_at else None,
                    "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                }

        if include_linked_signals:
            sig_limit = max(1, min(signal_limit, 50))
            sig_result = await self._db.execute(
                select(Signal, FeatureRequestSignal.representative_quote)
                .join(FeatureRequestSignal, FeatureRequestSignal.signal_id == Signal.id)
                .where(
                    FeatureRequestSignal.feature_request_id == fr_uuid,
                    Signal.organization_id == org_uuid,
                )
                .order_by(Signal.created_at.desc())
                .limit(sig_limit)
            )
            linked = []
            for sig, quote in sig_result.all():
                summary = sig.structured_summary or sig.transcript or sig.extracted_text or sig.original_text
                linked.append(
                    {
                        "signal_id": str(sig.id),
                        "source": sig.source,
                        "status": sig.status,
                        "summary": _clip_text(summary, 1200) if summary else "",
                        "representative_quote": _clip_text(quote, 800) if quote else None,
                        "urgency": sig.urgency,
                        "sentiment": sig.sentiment,
                        "created_at": sig.created_at.isoformat() if sig.created_at else None,
                    }
                )
            data["linked_signals"] = linked
            data["linked_signals_note"] = f"Showing up to {sig_limit} most recent linked signals."

        if include_agent_code_status:
            fr_id_str = str(fr_uuid)
            jobs_raw = await self._agent_get_json(f"/feature-requests/{fr_id_str}/jobs")
            pr_raw = await self._agent_get_json(f"/feature-requests/{fr_id_str}/pr-status")
            files_raw = await self._agent_get_json(f"/feature-requests/{fr_id_str}/pr-files")

            agent_block: dict[str, Any] = {
                "orchestration_jobs": jobs_raw,
                "pull_request": pr_raw,
            }

            if isinstance(files_raw, dict) and not files_raw.get("_fetch_error") and not files_raw.get("_http_status"):
                files = files_raw.get("files") or []
                agent_block["pull_request_files"] = {
                    "pull_request_url": files_raw.get("pull_request_url"),
                    "file_count": len(files),
                    "files": [
                        {
                            "filename": f.get("filename"),
                            "status": f.get("status"),
                            "additions": f.get("additions"),
                            "deletions": f.get("deletions"),
                        }
                        for f in files[:80]
                    ],
                }
                if len(files) > 80:
                    agent_block["pull_request_files"]["_truncated"] = True
            else:
                agent_block["pull_request_files"] = files_raw

            data["agent_and_code"] = agent_block

        return json.dumps(data, indent=2, default=str)

    async def _compare_feature_requests_code(self, raw_ids: Any) -> str:
        if not isinstance(raw_ids, list) or len(raw_ids) == 0:
            return "Error: feature_request_ids must be a non-empty array of UUID strings."

        max_n = 20
        id_strs = [str(x).strip() for x in raw_ids[:max_n] if x is not None and str(x).strip()]
        uuids: list[UUID] = []
        for s in id_strs:
            try:
                uuids.append(UUID(s))
            except ValueError:
                return f"Error: invalid UUID in feature_request_ids: {s}"

        org_uuid = UUID(self._org_id)
        result = await self._db.execute(
            select(FeatureRequest.id, FeatureRequest.title).where(
                FeatureRequest.organization_id == org_uuid,
                FeatureRequest.id.in_(uuids),
            )
        )
        id_to_title = {str(r.id): r.title for r in result.all()}
        missing = [str(u) for u in uuids if str(u) not in id_to_title]
        if missing:
            return json.dumps(
                {
                    "error": "feature_request_ids not found for this organization",
                    "missing": missing,
                },
                indent=2,
            )

        base = self._agent_base_url()
        if not base:
            out = [
                {
                    "id": str(u),
                    "title": id_to_title[str(u)],
                    "_note": self._AGENT_NOTE,
                }
                for u in uuids
            ]
            return json.dumps(
                {"sorted_by": "input_order", "agent_available": False, "count": len(out), "results": out},
                indent=2,
            )

        sem = asyncio.Semaphore(10)

        async def fetch_one(client: httpx.AsyncClient, fr_id: str) -> dict[str, Any]:
            async with sem:
                pr_raw = await self._agent_request(
                    client, base, f"/feature-requests/{fr_id}/pr-status"
                )
                files_raw = await self._agent_request(
                    client, base, f"/feature-requests/{fr_id}/pr-files"
                )
            agg = self._aggregate_pr_files_payload(files_raw)
            pr_state = pr_raw if isinstance(pr_raw, dict) else {}
            row: dict[str, Any] = {
                "id": fr_id,
                "title": id_to_title[fr_id],
                "pr_exists": pr_state.get("exists"),
                "pr_url": pr_state.get("url"),
                "pr_state": pr_state.get("state"),
                "total_additions": agg["total_additions"],
                "total_deletions": agg["total_deletions"],
                "file_count": agg["file_count"],
                "pull_request_url_from_diff": agg.get("pull_request_url"),
                "top_files": agg["top_files"],
            }
            if agg.get("_agent_error") or agg.get("_raw_error"):
                row["pr_files_error"] = agg.get("_agent_error") or agg.get("_raw_error")
            return row

        async with httpx.AsyncClient(timeout=35.0) as client:
            rows = list(await asyncio.gather(*(fetch_one(client, str(u)) for u in uuids)))

        rows.sort(key=lambda r: int(r.get("total_additions") or 0), reverse=True)
        return json.dumps(
            {
                "sorted_by": "total_additions_desc",
                "count": len(rows),
                "results": rows,
            },
            indent=2,
            default=str,
        )

    async def _get_signal_stats(self, period: str = "30d") -> str:
        org_uuid = UUID(self._org_id)

        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(period, 30)
        since = datetime.now(UTC) - timedelta(days=days)

        total_result = await self._db.execute(
            select(func.count(Signal.id)).where(
                Signal.organization_id == org_uuid,
                Signal.created_at >= since,
            )
        )
        total = total_result.scalar_one() or 0

        source_result = await self._db.execute(
            select(Signal.source, func.count(Signal.id))
            .where(Signal.organization_id == org_uuid, Signal.created_at >= since)
            .group_by(Signal.source)
        )
        by_source = {source: count for source, count in source_result.all()}

        status_result = await self._db.execute(
            select(Signal.status, func.count(Signal.id))
            .where(Signal.organization_id == org_uuid, Signal.created_at >= since)
            .group_by(Signal.status)
        )
        by_status = {status: count for status, count in status_result.all()}

        synthesized_result = await self._db.execute(
            select(func.count(Signal.id)).where(
                Signal.organization_id == org_uuid,
                Signal.created_at >= since,
                Signal.synthesized.is_(True),
            )
        )
        synthesized = synthesized_result.scalar_one() or 0

        data = {
            "period": period,
            "total_signals": total,
            "by_source": by_source,
            "by_status": by_status,
            "synthesized_signals": synthesized,
            "synthesis_rate": round(synthesized / total * 100, 1) if total > 0 else 0,
        }
        return json.dumps(data, indent=2)

    async def _get_connectors(self) -> str:
        org_uuid = UUID(self._org_id)
        result = await self._db.execute(
            select(Connector)
            .where(Connector.organization_id == org_uuid)
            .order_by(Connector.created_at.desc())
        )
        connectors = list(result.scalars().all())

        if not connectors:
            return "No connectors configured for your organization."

        data = {
            "connectors": [
                {
                    "id": str(c.id),
                    "name": c.name,
                    "type": c.type,
                    "enabled": c.enabled,
                    "has_credentials": bool(c.credentials),
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in connectors
            ],
            "total": len(connectors),
        }
        return json.dumps(data, indent=2)

    async def _get_dashboard_stats(self) -> str:
        org_uuid = UUID(self._org_id)

        signals_total = await self._db.execute(
            select(func.count(Signal.id)).where(Signal.organization_id == org_uuid)
        )
        total_signals = signals_total.scalar_one() or 0

        fr_total = await self._db.execute(
            select(func.count(FeatureRequest.id)).where(FeatureRequest.organization_id == org_uuid)
        )
        total_frs = fr_total.scalar_one() or 0

        connectors_active = await self._db.execute(
            select(func.count(Connector.id)).where(
                Connector.organization_id == org_uuid,
                Connector.enabled.is_(True),
            )
        )
        active_connectors = connectors_active.scalar_one() or 0

        triggers_active = await self._db.execute(
            select(func.count(Trigger.id)).where(
                Trigger.organization_id == org_uuid,
                Trigger.status == "active",
            )
        )
        active_triggers = triggers_active.scalar_one() or 0

        data = {
            "total_signals": total_signals,
            "total_feature_requests": total_frs,
            "active_connectors": active_connectors,
            "active_triggers": active_triggers,
        }
        return json.dumps(data, indent=2)

    async def _load_trigger_stats(self, trigger_ids: list[UUID]) -> dict[UUID, dict]:
        stats: dict[UUID, dict] = {tid: {} for tid in trigger_ids}
        since = datetime.now(UTC) - timedelta(hours=24)

        recent = await self._db.execute(
            select(IngestedEvent.trigger_id, func.count(IngestedEvent.id))
            .where(
                IngestedEvent.trigger_id.in_(trigger_ids),
                IngestedEvent.created_at >= since,
            )
            .group_by(IngestedEvent.trigger_id)
        )
        for tid, count in recent.all():
            if tid:
                stats[tid]["matched_events_24h"] = int(count or 0)

        features = await self._db.execute(
            select(Signal.trigger_id, func.count(func.distinct(FeatureRequest.id)))
            .join(
                FeatureRequest,
                FeatureRequest.id.in_(
                    select(FeatureRequest.id).where(
                        FeatureRequest.organization_id == UUID(self._org_id)
                    )
                ),
            )
            .where(Signal.trigger_id.in_(trigger_ids))
            .group_by(Signal.trigger_id)
        )
        for tid, count in features.all():
            if tid:
                stats[tid]["feature_request_count"] = int(count or 0)

        return stats
