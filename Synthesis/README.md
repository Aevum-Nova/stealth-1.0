# Ingestion & Synthesis Microservice

FastAPI microservice that ingests customer signals from multiple sources and synthesizes prioritized feature requests.

## Quick start

1. Copy `.env.example` to `.env`
2. Start dependencies: `docker compose up -d db`
3. Run migrations: `alembic upgrade head`
4. Start API: `uv run uvicorn src.main:app --reload --port 3001`

API docs: `http://localhost:3001/docs`
