"""Parse structured code change blocks from LLM chat responses."""

from __future__ import annotations

import json
import re


def extract_proposed_changes(text: str) -> list[dict] | None:
    """Extract proposed code changes from an assistant message.

    Looks for a JSON array of objects with file_path, content, reason keys.
    Returns None if no changes are found.
    """
    # Look for ```json ... ``` blocks containing an array
    json_blocks = re.findall(r"```json\s*\n(.*?)```", text, re.DOTALL)
    for block in json_blocks:
        parsed = _try_parse_changes(block.strip())
        if parsed is not None:
            return parsed

    # Fall back to looking for a raw JSON array in the text
    array_match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if array_match:
        parsed = _try_parse_changes(array_match.group())
        if parsed is not None:
            return parsed

    return None


def _try_parse_changes(text: str) -> list[dict] | None:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try closing truncated JSON
        for repair in ("", '"', '"}', '"}]', "}]"):
            try:
                data = json.loads(text + repair)
                break
            except json.JSONDecodeError:
                continue
        else:
            return None

    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        return None

    changes = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if "file_path" in item and "content" in item:
            changes.append({
                "file_path": str(item["file_path"]),
                "content": str(item["content"]),
                "reason": str(item.get("reason", "")),
            })

    return changes if changes else None
