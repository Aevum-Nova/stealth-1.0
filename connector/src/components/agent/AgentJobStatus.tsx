import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAgentJobs, useTriggerOrchestration } from "@/hooks/use-agent";
import type { AgentJob } from "@/types/agent";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  running: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800"
};

function JobCard({ job }: { job: AgentJob }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[job.status] ?? ""}`}>
          {job.status}
        </span>
        <time className="text-xs text-[var(--ink-soft)]">
          {new Date(job.created_at).toLocaleString()}
        </time>
      </div>

      {job.error && <p className="mt-2 text-rose-600">{job.error}</p>}

      {job.result && (
        <div className="mt-2 space-y-1">
          <p className="font-medium">{job.result.feature_name}</p>
          <p className="text-[var(--ink-soft)]">{job.result.spec_summary}</p>
          {job.result.dry_run && (
            <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Dry run</span>
          )}
          {job.result.tasks.length > 0 && (
            <ul className="ml-4 list-disc text-xs text-[var(--ink-soft)]">
              {job.result.tasks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          {job.result.proposed_files.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-medium">Proposed files:</p>
              <ul className="ml-4 list-disc text-xs text-[var(--ink-soft)]">
                {job.result.proposed_files.map((f, i) => (
                  <li key={i}>
                    <code>{f.file_path}</code> — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentJobStatus({ featureRequestId }: { featureRequestId: string }) {
  const jobsQuery = useAgentJobs(featureRequestId);
  const triggerMutation = useTriggerOrchestration(featureRequestId);

  const jobs = jobsQuery.data?.data ?? [];
  const hasActiveJob = jobs.some((j) => j.status === "pending" || j.status === "running");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Agent Jobs</h3>
      </div>

      <div className="flex gap-2">
        <button
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={hasActiveJob || triggerMutation.isPending}
          onClick={() => triggerMutation.mutate(true)}
        >
          {triggerMutation.isPending ? "Starting..." : "Generate PR (Dry Run)"}
        </button>
        <button
          className="rounded-lg border border-[var(--accent)] px-3 py-2 text-sm text-[var(--accent)] disabled:opacity-50"
          disabled={hasActiveJob || triggerMutation.isPending}
          onClick={() => triggerMutation.mutate(false)}
        >
          Generate PR
        </button>
      </div>

      {triggerMutation.isError && (
        <p className="text-sm text-rose-500">Failed to trigger orchestration.</p>
      )}

      {jobsQuery.isLoading && <LoadingSpinner label="Loading jobs..." />}

      <div className="space-y-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
        {jobs.length === 0 && !jobsQuery.isLoading && (
          <p className="text-sm text-[var(--ink-soft)]">No jobs yet.</p>
        )}
      </div>
    </div>
  );
}
