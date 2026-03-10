"""Split source files into embeddable chunks using simple heuristics."""

from __future__ import annotations

import re
from dataclasses import dataclass

LANG_MAP: dict[str, str] = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".jsx": "javascript", ".rs": "rust",
    ".go": "go", ".java": "java", ".kt": "kotlin", ".rb": "ruby",
    ".php": "php", ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
    ".cs": "csharp", ".swift": "swift", ".scala": "scala",
    ".html": "html", ".css": "css", ".scss": "scss", ".vue": "vue",
    ".svelte": "svelte", ".sql": "sql", ".sh": "shell",
    ".json": "json", ".yaml": "yaml", ".yml": "yaml",
    ".toml": "toml", ".md": "markdown", ".xml": "xml",
}

MAX_CHUNK_LINES = 200
MIN_CHUNK_LINES = 20
OVERLAP_LINES = 10

# Patterns that signal a new top-level block in various languages
BOUNDARY_PATTERNS: dict[str, re.Pattern[str]] = {
    "python": re.compile(r"^(class |def |async def )", re.MULTILINE),
    "javascript": re.compile(r"^(export |function |class |const \w+ = )", re.MULTILINE),
    "typescript": re.compile(r"^(export |function |class |interface |type |const \w+ = )", re.MULTILINE),
    "rust": re.compile(r"^(pub |fn |impl |struct |enum |trait |mod )", re.MULTILINE),
    "go": re.compile(r"^(func |type |var )", re.MULTILINE),
    "java": re.compile(r"^(public |private |protected |class |interface )", re.MULTILINE),
    "ruby": re.compile(r"^(class |module |def )", re.MULTILINE),
}


@dataclass(slots=True)
class CodeChunkData:
    file_path: str
    start_line: int
    end_line: int
    content: str
    language: str


def detect_language(file_path: str) -> str:
    idx = file_path.rfind(".")
    if idx < 0:
        name = file_path.rsplit("/", 1)[-1].lower()
        if name in ("makefile", "dockerfile"):
            return name
        return "text"
    return LANG_MAP.get(file_path[idx:].lower(), "text")


def _find_boundaries(lines: list[str], language: str) -> list[int]:
    """Return 0-based line indices that start a new logical block."""
    pattern = BOUNDARY_PATTERNS.get(language)
    if pattern is None:
        return []

    boundaries: list[int] = []
    for i, line in enumerate(lines):
        if pattern.match(line):
            boundaries.append(i)
    return boundaries


def chunk_file(file_path: str, content: str) -> list[CodeChunkData]:
    language = detect_language(file_path)
    lines = content.split("\n")
    total = len(lines)

    if total <= MAX_CHUNK_LINES:
        return [CodeChunkData(
            file_path=file_path,
            start_line=1,
            end_line=total,
            content=content,
            language=language,
        )]

    boundaries = _find_boundaries(lines, language)

    chunks: list[CodeChunkData] = []

    if boundaries:
        # Split on semantic boundaries, merging small consecutive blocks
        segments: list[tuple[int, int]] = []
        for idx, boundary in enumerate(boundaries):
            end = boundaries[idx + 1] if idx + 1 < len(boundaries) else total
            segments.append((boundary, end))

        current_start = 0
        current_end = 0

        for seg_start, seg_end in segments:
            if current_end == 0:
                current_start = seg_start
                current_end = seg_end
                continue

            if seg_end - current_start > MAX_CHUNK_LINES:
                # Emit current chunk
                chunks.append(CodeChunkData(
                    file_path=file_path,
                    start_line=current_start + 1,
                    end_line=current_end,
                    content="\n".join(lines[current_start:current_end]),
                    language=language,
                ))
                current_start = seg_start
                current_end = seg_end
            else:
                current_end = seg_end

        # Emit the last chunk
        if current_start < total:
            chunks.append(CodeChunkData(
                file_path=file_path,
                start_line=current_start + 1,
                end_line=min(current_end, total),
                content="\n".join(lines[current_start:current_end]),
                language=language,
            ))

        # If there are lines before the first boundary, prepend them
        if boundaries and boundaries[0] > 0 and (not chunks or chunks[0].start_line > 1):
            preamble_end = boundaries[0]
            chunks.insert(0, CodeChunkData(
                file_path=file_path,
                start_line=1,
                end_line=preamble_end,
                content="\n".join(lines[:preamble_end]),
                language=language,
            ))
    else:
        # Fall back to fixed-size windows with overlap
        start = 0
        while start < total:
            end = min(start + MAX_CHUNK_LINES, total)
            chunks.append(CodeChunkData(
                file_path=file_path,
                start_line=start + 1,
                end_line=end,
                content="\n".join(lines[start:end]),
                language=language,
            ))
            if end >= total:
                break
            start = end - OVERLAP_LINES

    # Filter out tiny chunks (< MIN_CHUNK_LINES) by merging into previous
    merged: list[CodeChunkData] = []
    for chunk in chunks:
        line_count = chunk.end_line - chunk.start_line + 1
        if merged and line_count < MIN_CHUNK_LINES:
            prev = merged[-1]
            combined_content = prev.content + "\n" + chunk.content
            merged[-1] = CodeChunkData(
                file_path=file_path,
                start_line=prev.start_line,
                end_line=chunk.end_line,
                content=combined_content,
                language=language,
            )
        else:
            merged.append(chunk)

    return merged if merged else [CodeChunkData(
        file_path=file_path,
        start_line=1,
        end_line=total,
        content=content,
        language=language,
    )]
