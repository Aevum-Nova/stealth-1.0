"""Parse structured code change blocks from LLM chat responses."""

from __future__ import annotations

import json
import re


def extract_proposed_changes(text: str, *, intent: str = "question") -> list[dict] | None:
    """Extract proposed code changes from an assistant message.

    Supports two formats in the JSON:
      - Full-file: {"file_path", "content", "reason"}
      - Search/replace: {"file_path", "search_replace": [{"search", "replace"}], "reason"}
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

    if intent == "change":
        changes = _extract_from_file_path_code_blocks(text)
        if changes:
            return changes

    return None


def _extract_from_file_path_code_blocks(text: str) -> list[dict] | None:
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
        if "file_path" not in item:
            continue

        change: dict = {
            "file_path": str(item["file_path"]),
            "reason": str(item.get("reason", "")),
        }

        if "search_replace" in item and isinstance(item["search_replace"], list):
            sr_list = []
            for sr in item["search_replace"]:
                if isinstance(sr, dict) and "search" in sr and "replace" in sr:
                    sr_list.append({
                        "search": str(sr["search"]),
                        "replace": str(sr["replace"]),
                    })
            if sr_list:
                change["search_replace"] = sr_list
                change["content"] = ""
                changes.append(change)
        elif "content" in item:
            change["content"] = str(item["content"])
            changes.append(change)

    return changes if changes else None


def apply_search_replace(original: str, patches: list[dict]) -> str:
    """Apply a list of search/replace patches to the original file content.

    Each patch: {"search": "exact text", "replace": "replacement text"}
    Returns the modified file content.
    Raises ValueError if a search block is not found in the file.
    """
    result = original
    for patch in patches:
        search = patch["search"]
        replace = patch["replace"]
        if search not in result:
            # Try with normalized line endings
            normalized_search = search.replace("\r\n", "\n")
            normalized_result = result.replace("\r\n", "\n")
            if normalized_search not in normalized_result:
                raise ValueError(
                    f"Search block not found in file:\n{search[:200]}..."
                )
            result = normalized_result.replace(normalized_search, replace, 1)
        else:
            result = result.replace(search, replace, 1)
    return result
