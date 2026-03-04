from __future__ import annotations

import argparse
import json

from stealth_agent.adapters.local import (
    LocalCodeGenerator,
    LocalGitProvider,
    LocalPullRequestProvider,
    LocalRepositoryAnalyzer,
    LocalSignalProcessor,
    LocalSpecPlanner,
)
from stealth_agent.parsing import load_feature_request
from stealth_agent.services.orchestrator import FeatureToPROrchestrator, OrchestrationDependencies


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Stealth agent CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_cmd = subparsers.add_parser("run", help="Run feature-to-PR orchestration")
    run_cmd.add_argument("--input", required=True, help="Path to feature request JSON")
    run_cmd.add_argument("--dry-run", action="store_true", help="Do not write changes or open PR")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "run":
        request = load_feature_request(args.input)

        deps = OrchestrationDependencies(
            signal_processor=LocalSignalProcessor(),
            repository_analyzer=LocalRepositoryAnalyzer(),
            spec_planner=LocalSpecPlanner(),
            code_generator=LocalCodeGenerator(),
            git_provider=LocalGitProvider(),
            pr_provider=LocalPullRequestProvider(),
        )
        orchestrator = FeatureToPROrchestrator(deps)
        result = orchestrator.run(request=request, dry_run=args.dry_run)

        output = {
            "request_id": result.request_id,
            "prioritized_feature": {
                "name": result.prioritized_feature.name,
                "priority_score": result.prioritized_feature.priority_score,
            },
            "spec_summary": result.spec.summary,
            "planned_tasks": result.technical_plan.tasks,
            "pr_draft": {
                "title": result.pr_draft.title,
                "branch_name": result.pr_draft.branch_name,
                "changed_files": result.pr_draft.changed_files,
            },
            "commit_sha": result.commit_sha,
            "pull_request_url": result.pull_request_url,
        }
        print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
