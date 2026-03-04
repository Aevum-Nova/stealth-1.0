# Stealth 1.0 Project Memory

## Architecture
- Monorepo: `synthesis/` (FastAPI backend, port 3001), `agent/` (FastAPI agent, port 3002), `connector/` (React frontend, port 5173)
- Shared PostgreSQL database between synthesis and agent services
- Auth: Google OAuth → JWT + refresh token rotation
- Connectors: OAuth2 or API key based, stored in `connectors` table with JSONB credentials/config

## Key Patterns
- Connector catalog defined in `synthesis/src/connectors/catalog.py`
- Connector implementations in `synthesis/src/connectors/{type}.py` extending `BaseConnector`
- Route registration in `synthesis/src/routes/connectors.py` via `CONNECTOR_IMPL` and `CONNECTOR_REQUIRED_ENV_VARS` dicts
- Agent uses protocol-based adapters (`GitProvider`, `PullRequestProvider`) with local stubs and GitHub implementations
- Agent reads connector table to get GitHub token for PR creation

## GitHub Integration (added)
- GitHub OAuth connector in synthesis for repo connection
- Frontend repo picker on connector setup page
- Agent `GitHubGitProvider` and `GitHubPullRequestProvider` in `agent/stealth_agent/adapters/github.py`
- Agent looks up org's GitHub connector in `jobs.py` `_run_orchestration()` to use real GitHub API
- GitHub API endpoints: `GET /{id}/github-repos`, `GET /{id}/github-branches`

## Environment
- Python backend, React 19 + TypeScript frontend
- TanStack Query for data fetching, `ky` HTTP client
- Agent needs `httpx` dependency for GitHub API calls
