import type { JobSummary } from "@/api/jobs";

import { formatDate } from "@/lib/utils";

export default function IngestionHistory({ jobs }: { jobs: JobSummary[] }) {
  const ingestionJobs = jobs.filter((job) => job.type === "ingestion").slice(0, 10);

  return (
    <section className="panel elevated p-4">
      <h3 className="mb-3 text-lg">Recent Uploads</h3>
      <div className="space-y-2">
        {ingestionJobs.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No ingestion jobs yet.</p>
        ) : (
          ingestionJobs.map((job) => {
            const total = job.total_items ?? 0;
            const processed = job.processed_items ?? 0;
            const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
            return (
              <article key={job.id} className="rounded-lg border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Job {job.id.slice(0, 8)}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{formatDate(job.created_at)}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#eee4d0]">
                  <div className="h-full rounded-full bg-[var(--moss)]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-[var(--ink-soft)]">
                  {processed}/{total} processed · {job.failed_items ?? 0} failed · {job.status}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
