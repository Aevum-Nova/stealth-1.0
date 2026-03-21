"""Parse structured code change blocks from LLM chat responses."""

from __future__ import annotations

import json
import re


def extract_proposed_changes(text: str, *, intent: str = "question") -> list[dict] | None:
    """Extract proposed code changes from an assistant message.

    Looks for a JSON array of objects with file_path, content, reason keys.
    Falls back to "# Proposed Changes for path" + code block pattern.
    When intent is "change", uses a broader fallback that detects any file path + code block.
    Returns None if no changes are found.
    """
    # Primary: ```json ... ``` blocks containing an array
    json_blocks = re.findall(r"```json\s*\n(.*?)```", text, re.DOTALL)
    for block in json_blocks:
        parsed = _try_parse_changes(block.strip())
        if parsed is not None:
            return parsed

    # Secondary: raw JSON array in the text
    array_match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if array_match:
        parsed = _try_parse_changes(array_match.group())
        if parsed is not None:
            return parsed

    # Fallback: "# Proposed Changes for path" + ```lang code block
    md_match = re.search(
        r"#+\s*Proposed Changes? (?:for\s+)?([^\n]+)\s*\n+```\w*\n([\s\S]*?)```",
        text,
        re.IGNORECASE,
    )
    if md_match:
        file_path = md_match.group(1).strip()
        content = md_match.group(2).strip()
        if file_path and content:
            return [
                {"file_path": file_path, "content": content, "reason": ""},
            ]

    # Intent-aware fallback: when user requested a change,
    # extract any file path reference followed by a code block
    if intent == "change":
        changes = _extract_from_file_path_code_blocks(text)
        if changes:
            return changes

    return None


def _extract_from_file_path_code_blocks(text: str) -> list[dict] | None:
    """When the LLM didn't follow JSON format but the user asked for a change,
    look for lines referencing a file path followed by a fenced code block."""
    FILE_EXT = r"(?:jsx?|tsx?|css|scss|less|html|py|rb|go|rs|java|kt|json|ya?ml|toml|sh|sql|svelte|vue|php|c|cpp|h|hpp|cs|swift|md)"
    pattern = re.compile(
        r"(?:^|\n)[#*\s]*(?:(?:Updated?|Modified|Changed|Here(?:'s| is))(?: the)?[:\s]+)?"
        r"[`*]*"
        r"([\w./-]+\." + FILE_EXT + r")"
        r"[`*:]*\s*\n+"
        r"```\w*\n([\s\S]*?)```",
        re.IGNORECASE,
    )
    changes = []
    for match in pattern.finditer(text):
        file_path = match.group(1).strip()
        content = match.group(2).strip()
        if file_path and content:
            changes.append({
                "file_path": file_path,
                "content": content,
                "reason": "",
            })
    return changes if changes else None


def _try_parse_changes(text: str) -> list[dict] | None:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
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
