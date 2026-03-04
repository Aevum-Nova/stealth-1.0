# Stealth Agent (Scaffold)

This repository contains the foundational Python infrastructure for an agentic workflow that turns product feedback into scoped pull requests.

## Current capabilities

- Typed feature request and execution models
- Orchestrator pipeline with pluggable adapters
- Local stub adapters for end-to-end dry runs
- CLI entrypoint for running from JSON input

## Quickstart

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Create an input file:

```json
{
  "request_id": "req_001",
  "title": "Bulk export customer feedback",
  "problem_statement": "Support teams need to export tagged tickets weekly.",
  "evidence": [
    {
      "source_type": "support_ticket",
      "source_id": "zendesk_99",
      "snippet": "Need CSV export by team and date range",
      "weight": 0.8
    }
  ],
  "business_context": {
    "target_metric": "reduce support manual work",
    "priority": "high"
  },
  "constraints": {
    "max_files_changed": 5,
    "risk_tolerance": "low"
  },
  "repository": {
    "path": ".",
    "default_branch": "main"
  }
}
```

Run:

```bash
stealth-agent run --input request.json --dry-run
```
