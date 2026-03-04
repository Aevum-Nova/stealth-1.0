"""Uvicorn entry point for the agent service."""

from __future__ import annotations

import uvicorn

from stealth_agent.config import settings


def main() -> None:
    uvicorn.run(
        "stealth_agent.app:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )


if __name__ == "__main__":
    main()
