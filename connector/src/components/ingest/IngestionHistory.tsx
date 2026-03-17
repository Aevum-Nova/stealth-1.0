import type { JobSummary } from "@/api/jobs";
import { timeAgo } from "@/lib/utils";

function statusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-[var(--success)]";
    case "processing":
      return "bg-[var(--warning)]";
    case "completed_with_errors":
      return "bg-[var(--danger)]";
    default:
      return "bg-[var(--ink-muted)]";
  }
}

export default function IngestionHistory({ jobs }: { jobs: JobSummary[] }) {
  const ingestionJobs = jobs.filter((job) => job.type === "ingestion").slice(0, 10);

  if (ingestionJobs.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
        Recent Uploads
      </h3>
      <div className="space-y-2">
        {ingestionJobs.map((job) => {
          const total = job.total_items ?? 0;
          const processed = job.processed_items ?? 0;
          const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

          return (
            <article key={job.id} className="panel p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${statusColor(job.status)}`} />
                  <p className="text-[13px] font-medium">Job {job.id.slice(0, 8)}</p>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">{timeAgo(job.created_at)}</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--ink)] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">
                {processed}/{total} processed
                {(job.failed_items ?? 0) > 0 && (
                  <span className="text-[var(--danger)]"> · {job.failed_items} failed</span>
                )}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
