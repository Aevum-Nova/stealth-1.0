import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFeatureRequest, useFeatureRequestActions, usePatchFeatureRequest } from "@/hooks/use-feature-requests";
import { useAgentJobs, useTriggerOrchestration } from "@/hooks/use-agent";
import type { AgentJob } from "@/types/agent";

const statusPill: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  running: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700"
};

function AgentThread({ jobs }: { jobs: AgentJob[] }) {
  if (jobs.length === 0) {
    return <p className="p-4 text-[13px] text-[var(--ink-soft)]">No runs yet. Start with Generate (Dry Run).</p>;
  }

  return (
    <div className="space-y-3 p-3">
      {jobs.map((job) => (
        <article key={job.id} className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusPill[job.status] ?? "bg-[var(--accent-soft)] text-[var(--ink-soft)]"}`}>
              {job.status}
            </span>
            <time className="text-[10px] text-[var(--ink-muted)]">{new Date(job.created_at).toLocaleString()}</time>
          </div>

          {job.error ? <p className="mt-2 text-[12px] text-rose-600">{job.error}</p> : null}

          {job.result ? (
            <div className="mt-2 space-y-2 text-[12px]">
              <p className="font-medium text-[var(--ink)]">{job.result.feature_name}</p>
              <p className="text-[var(--ink-soft)]">{job.result.spec_summary}</p>
              {job.result.tasks.length > 0 ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Planned Tasks</p>
                  <ul className="mt-1 space-y-1 text-[var(--ink-soft)]">
                    {job.result.tasks.map((task, idx) => (
                      <li key={`${job.id}-task-${idx}`}>• {task}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function CodeChanges({ jobs }: { jobs: AgentJob[] }) {
  const latestWithChanges = jobs.find((job) => (job.result?.proposed_files.length ?? 0) > 0);
  if (!latestWithChanges?.result) {
    return <p className="p-4 text-[13px] text-[var(--ink-soft)]">No proposed code changes yet.</p>;
  }

  const proposed = latestWithChanges.result.proposed_files;
  return (
    <div className="space-y-2 p-3">
      <p className="px-1 text-[11px] text-[var(--ink-muted)]">{proposed.length} files changed</p>
      {proposed.map((item) => (
        <div key={`${latestWithChanges.id}-${item.file_path}`} className="rounded-lg bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-2">
            <code className="truncate text-[11px] text-[var(--ink)]">{item.file_path}</code>
            <div className="shrink-0 text-[11px] font-medium tabular-nums">
              <span className="text-emerald-600">+{item.additions ?? 0}</span>
              <span className="mx-1 text-[var(--ink-muted)]">·</span>
              <span className="text-rose-600">-{item.deletions ?? 0}</span>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-[var(--ink-soft)]">{item.reason}</p>
        </div>
      ))}
    </div>
  );
}

export default function ProductContextPage() {
  const { id = "" } = useParams();
  const featureRequestQuery = useFeatureRequest(id);
  const patchMutation = usePatchFeatureRequest(id);
  const actions = useFeatureRequestActions();
  const jobsQuery = useAgentJobs(id);
  const triggerMutation = useTriggerOrchestration(id);
  const fr = featureRequestQuery.data?.data ?? null;
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    if (fr?.title) {
      setTitleDraft(fr.title);
    }
  }, [fr?.title]);

  const sourceBreakdown = useMemo(
    () => Object.entries(fr?.impact_metrics?.source_breakdown ?? {}),
    [fr?.impact_metrics?.source_breakdown]
  );

  if (featureRequestQuery.isLoading) {
    return <LoadingSpinner label="Loading feature request" />;
  }
  if (featureRequestQuery.isError || !fr) {
    return <EmptyState title="Feature request not found" description="This item may have been removed." />;
  }

  const jobs = jobsQuery.data?.data ?? [];
  const hasActiveJob = jobs.some((j) => j.status === "pending" || j.status === "running");
  const latestPrUrl = jobs.find((job) => job.result?.pull_request_url)?.result?.pull_request_url ?? null;

  return (
    <div className="h-full">
      <div className="h-full overflow-hidden rounded-xl bg-[#f6f6f7] text-[var(--ink)]">
        <div className="flex items-center justify-between px-5 py-3">
          <Link to="/feature-requests" className="inline-flex items-center gap-1 text-[12px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
            ← Back to Feature Requests
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold">{fr.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--line)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">
              {fr.status}
            </span>
            <PriorityBadge priority={fr.priority} />
            <button
              className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
              disabled={hasActiveJob || triggerMutation.isPending}
              onClick={() => triggerMutation.mutate(true)}
            >
              Generate (Dry Run)
            </button>
            <button
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              disabled={hasActiveJob || triggerMutation.isPending}
              onClick={() => triggerMutation.mutate(false)}
            >
              Generate PR
            </button>
            <button
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              disabled={actions.approve.isPending}
              onClick={() => actions.approve.mutate(fr.id)}
            >
              Approve
            </button>
            <button
              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              disabled={actions.reject.isPending}
              onClick={() => actions.reject.mutate(fr.id)}
            >
              Reject
            </button>
            {latestPrUrl ? (
              <a
                href={latestPrUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Open PR
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid min-h-[72vh] grid-cols-1 gap-3 px-3 pb-3 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="rounded-xl bg-[#fcfcfd] p-1">
            <div className="space-y-4 p-3">
              <section className="rounded-xl bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Feature Request</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    className="flex-1 rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-[12px] text-[var(--ink)] outline-none"
                  />
                  <button
                    className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--ink)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
                    disabled={titleDraft.trim().length === 0 || titleDraft.trim() === fr.title || patchMutation.isPending}
                    onClick={() => patchMutation.mutate({ title: titleDraft.trim() })}
                  >
                    Save
                  </button>
                </div>
              </section>

              <section className="rounded-xl bg-white p-3.5 text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Impact Metrics</p>
                <p className="mt-2 text-[var(--ink)]">
                  {fr.impact_metrics?.signal_count ?? 0} signals · {fr.impact_metrics?.unique_customers ?? 0} customers · {fr.impact_metrics?.unique_companies ?? 0} companies
                </p>
                <p className="mt-1 text-[var(--ink-soft)]">
                  Urgency {(fr.impact_metrics?.avg_urgency_score ?? 0).toFixed(2)} / {fr.impact_metrics?.trend_direction ?? "stable"}
                </p>
                {sourceBreakdown.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sourceBreakdown.map(([source, count]) => (
                      <span key={source} className="rounded-full border border-[var(--line)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--ink-soft)]">
                        {source}: {count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="rounded-xl bg-white p-3.5 text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Supporting Evidence</p>
                <div className="mt-2 space-y-2">
                  {(fr.supporting_evidence ?? []).length === 0 ? (
                    <p className="text-[var(--ink-soft)]">No evidence linked.</p>
                  ) : (
                    fr.supporting_evidence.slice(0, 6).map((item) => (
                      <article key={item.signal_id} className="rounded-lg bg-[#f8f8f9] p-2.5">
                        <p className="text-[10px] text-[var(--ink-muted)]">{item.source}</p>
                        <p className="mt-1 line-clamp-3 text-[11px] text-[var(--ink-soft)]">"{item.representative_quote}"</p>
                        <Link to={`/signals/${item.signal_id}`} className="mt-1 inline-block text-[10px] text-[var(--ink-soft)] hover:text-[var(--ink)]">
                          Open signal →
                        </Link>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </aside>

          <main className="rounded-xl bg-[#fcfcfd] p-1">
            <div className="px-4 pt-3 text-[11px] font-medium text-[var(--ink-muted)]">Agent Thread</div>
            {jobsQuery.isLoading ? (
              <div className="p-4">
                <LoadingSpinner label="Loading runs..." />
              </div>
            ) : (
              <AgentThread jobs={jobs} />
            )}
          </main>

          <aside className="rounded-xl bg-[#fcfcfd] p-1">
            <div className="px-4 pt-3 text-[11px] font-medium text-[var(--ink-muted)]">Code Changes</div>
            {jobsQuery.isLoading ? (
              <div className="p-4">
                <LoadingSpinner label="Loading code changes..." />
              </div>
            ) : (
              <CodeChanges jobs={jobs} />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
