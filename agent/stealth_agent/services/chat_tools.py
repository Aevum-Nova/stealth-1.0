"""Tool definitions and executor for agentic chat loop."""

from __future__ import annotations

import uuid

import structlog

from stealth_agent.adapters.github_repo import GitHubRepoFetcher
from stealth_agent.services.code_retriever import retrieve_relevant_chunks

log = structlog.get_logger()

TOOL_SCHEMAS: list[dict] = [
    {
        "name": "read_file",
        "description": (
            "Read the full contents of a file from the repository. "
            "Use this to inspect any source file before making changes. "
            "Returns the file content as text, or an error if the file doesn't exist."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The file path relative to the repo root (e.g. 'src/components/Button.jsx').",
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "search_code",
        "description": (
            "Semantic search over the indexed codebase. Returns the most relevant "
            "code chunks matching a natural-language query. Use this to find where "
            "something is defined, how a feature is implemented, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query (e.g. 'modal overlay styling', 'authentication middleware').",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "list_files",
        "description": (
            "List all files in the repository (or a subdirectory). "
            "Returns file paths only, not contents. Use this to discover "
            "the project structure before reading specific files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "Optional directory prefix to filter (e.g. 'src/components'). Leave empty for the full tree.",
                    "default": "",
                },
            },
            "required": [],
        },
    },
]


class ToolExecutor:
    """Executes tool calls against a GitHub repo and code index."""

    def __init__(
        self,
        fetcher: GitHubRepoFetcher,
        connector_id: uuid.UUID,
        organization_id: uuid.UUID,
        branch: str | None = None,
    ) -> None:
        self._fetcher = fetcher
        self._connector_id = connector_id
        self._organization_id = organization_id
        self._branch = branch
        self._tree_cache: list[str] | None = None

    async def execute(self, tool_name: str, tool_input: dict) -> str:
        """Dispatch a tool call and return the string result."""
        try:
            if tool_name == "read_file":
                return await self._read_file(tool_input.get("path", ""))
            elif tool_name == "search_code":
                return await self._search_code(tool_input.get("query", ""))
            elif tool_name == "list_files":
                return await self._list_files(tool_input.get("directory", ""))
            else:
                return f"Unknown tool: {tool_name}"
        except Exception as exc:
            log.warning("tool_execution_error", tool=tool_name, error=str(exc))
            return f"Error executing {tool_name}: {exc}"

    def status_message(self, tool_name: str, tool_input: dict) -> str:
        """Human-readable status for the frontend while a tool runs."""
        if tool_name == "read_file":
            return f"Reading {tool_input.get('path', 'file')}..."
        elif tool_name == "search_code":
            return f"Searching for \"{tool_input.get('query', '')}\"..."
        elif tool_name == "list_files":
            d = tool_input.get("directory", "")
            return f"Listing files in {d or 'repository'}..."
        return f"Running {tool_name}..."

    async def _read_file(self, path: str) -> str:
        if not path:
            return "Error: path is required."
        content = await self._fetcher.fetch_file(path, ref=self._branch)
        if content is None:
            return f"File not found: {path}"
        return content

    async def _search_code(self, query: str) -> str:
        if not query:
            return "Error: query is required."
        chunks = await retrieve_relevant_chunks(
            query=query,
            connector_id=self._connector_id,
            organization_id=self._organization_id,
            top_k=10,
        )
        if not chunks:
            return "No matching code found."

        parts = []
        for c in chunks:
            parts.append(
                f"--- {c.file_path}:{c.start_line}-{c.end_line} ({c.language}) ---\n"
                f"{c.content}\n---"
            )
        return "\n\n".join(parts)

    async def _list_files(self, directory: str) -> str:
        if self._tree_cache is None:
            try:
                branch = self._branch or "main"
                sha = await self._fetcher.get_default_branch_sha(branch)
                tree = await self._fetcher.get_tree(sha)
                self._tree_cache = [
                    item["path"] for item in tree if item["type"] == "blob"
                ]
            except Exception as exc:
                return f"Error listing files: {exc}"

        paths = self._tree_cache
        if directory:
            prefix = directory.rstrip("/") + "/"
            paths = [p for p in paths if p.startswith(prefix)]

        if not paths:
            return f"No files found in {directory or 'repository'}."

        if len(paths) > 200:
            return "\n".join(paths[:200]) + f"\n... and {len(paths) - 200} more files"
        return "\n".join(paths)
