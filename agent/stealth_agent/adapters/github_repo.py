"""GitHub repository content fetcher for codebase indexing."""

from __future__ import annotations

import asyncio
import base64
from dataclasses import dataclass, field

import httpx
import structlog

log = structlog.get_logger()

GITHUB_API_BASE = "https://api.github.com"

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", ".nuxt", "dist", "build",
    ".tox", ".venv", "venv", "env", ".mypy_cache", ".pytest_cache",
    "vendor", "target", ".gradle", ".idea", ".vscode",
}

SKIP_EXTENSIONS = {
    ".lock", ".min.js", ".min.css", ".map", ".woff", ".woff2", ".ttf",
    ".eot", ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
    ".mp3", ".mp4", ".wav", ".pdf", ".zip", ".tar", ".gz", ".br",
    ".pyc", ".pyo", ".class", ".o", ".so", ".dylib", ".dll", ".exe",
    ".DS_Store",
}

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".rs", ".go", ".java", ".kt",
    ".rb", ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".m",
    ".scala", ".clj", ".ex", ".exs", ".erl", ".hs", ".lua", ".r",
    ".sql", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat",
    ".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".xml", ".md", ".rst", ".txt", ".env.example",
    ".dockerfile", ".graphql", ".proto", ".prisma",
}

MAX_FILE_SIZE = 100_000  # 100KB
FETCH_CONCURRENCY = 10  # Max concurrent file fetches (avoids GitHub rate limits)


@dataclass
class RepoFile:
    path: str
    content: str
    size: int
    sha: str


@dataclass
class GitHubRepoFetcher:
    token: str
    owner: str
    repo: str
    _client: httpx.AsyncClient = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=GITHUB_API_BASE,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get_default_branch_sha(self, branch: str = "main") -> str:
        resp = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/git/ref/heads/{branch}"
        )
        resp.raise_for_status()
        return resp.json()["object"]["sha"]

    async def get_tree(self, sha: str) -> list[dict]:
        resp = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/git/trees/{sha}",
            params={"recursive": "1"},
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("truncated"):
            log.warning("github_tree_truncated", owner=self.owner, repo=self.repo)
        return data.get("tree", [])

    def _should_index(self, path: str, size: int) -> bool:
        parts = path.split("/")
        for part in parts[:-1]:
            if part in SKIP_DIRS:
                return False

        if size > MAX_FILE_SIZE:
            return False

        filename = parts[-1]
        if filename.startswith(".") and filename not in {".env.example", ".dockerfile"}:
            dot_ext = "." + filename
            if dot_ext in SKIP_EXTENSIONS:
                return False

        ext_idx = filename.rfind(".")
        if ext_idx >= 0:
            ext = filename[ext_idx:].lower()
            if ext in SKIP_EXTENSIONS:
                return False
            return ext in CODE_EXTENSIONS

        # Files with no extension (Makefile, Dockerfile, etc.)
        return filename in {"Makefile", "Dockerfile", "Procfile", "Gemfile", "Rakefile"}

    async def fetch_file(self, path: str) -> str | None:
        try:
            resp = await self._client.get(
                f"/repos/{self.owner}/{self.repo}/contents/{path}"
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data.get("encoding") == "base64" and data.get("content"):
                return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return None
        except Exception:
            log.warning("github_fetch_file_error", path=path)
            return None

    async def fetch_indexable_files(self, branch: str = "main") -> list[RepoFile]:
        sha = await self.get_default_branch_sha(branch)
        tree = await self.get_tree(sha)

        blobs = [
            item for item in tree
            if item["type"] == "blob" and self._should_index(item["path"], item.get("size", 0))
        ]

        log.info("github_indexable_files", total_tree=len(tree), indexable=len(blobs))

        sem = asyncio.Semaphore(FETCH_CONCURRENCY)

        async def fetch_one(item: dict) -> RepoFile | None:
            async with sem:
                content = await self.fetch_file(item["path"])
                if content is None:
                    return None
                return RepoFile(
                    path=item["path"],
                    content=content,
                    size=item.get("size", len(content)),
                    sha=item["sha"],
                )

        results = await asyncio.gather(*(fetch_one(item) for item in blobs))
        return [f for f in results if f is not None]
