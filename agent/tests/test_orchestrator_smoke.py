from stealth_agent.adapters.local import (
    LocalCodeGenerator,
    LocalGitProvider,
    LocalPullRequestProvider,
    LocalRepositoryAnalyzer,
    LocalSignalProcessor,
    LocalSpecPlanner,
)
from stealth_agent.domain.models import EvidenceItem, FeatureRequest, RepositoryContext, SourceType
from stealth_agent.services.orchestrator import FeatureToPROrchestrator, OrchestrationDependencies


def _request() -> FeatureRequest:
    return FeatureRequest(
        request_id="req_abc",
        title="Export tagged feedback",
        problem_statement="Users need faster recurring exports",
        evidence=[
            EvidenceItem(
                source_type=SourceType.SUPPORT_TICKET,
                source_id="zd_1",
                snippet="Need export",
                weight=0.8,
            )
        ],
        repository=RepositoryContext(path="."),
    )


def test_orchestrator_dry_run() -> None:
    deps = OrchestrationDependencies(
        signal_processor=LocalSignalProcessor(),
        repository_analyzer=LocalRepositoryAnalyzer(),
        spec_planner=LocalSpecPlanner(),
        code_generator=LocalCodeGenerator(),
        git_provider=LocalGitProvider(),
        pr_provider=LocalPullRequestProvider(),
    )

    result = FeatureToPROrchestrator(deps).run(_request(), dry_run=True)

    assert result.request_id == "req_abc"
    assert result.pr_draft.title.startswith("[Draft]")
    assert result.commit_sha is None
    assert result.pull_request_url is None


def test_orchestrator_non_dry_run() -> None:
    deps = OrchestrationDependencies(
        signal_processor=LocalSignalProcessor(),
        repository_analyzer=LocalRepositoryAnalyzer(),
        spec_planner=LocalSpecPlanner(),
        code_generator=LocalCodeGenerator(),
        git_provider=LocalGitProvider(),
        pr_provider=LocalPullRequestProvider(),
    )

    result = FeatureToPROrchestrator(deps).run(_request(), dry_run=False)

    assert result.commit_sha is not None
    assert result.pull_request_url is not None
