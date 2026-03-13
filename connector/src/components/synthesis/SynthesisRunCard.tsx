import type { SynthesisRun } from "@/api/synthesis";
import { formatDate } from "@/lib/utils";

import SynthesisProgressBar from "@/components/synthesis/SynthesisProgressBar";

function getStatusProgress(status: string) {
  switch (status) {
    case "completed":
    case "failed":
      return 100;
    case "prioritizing":
      return 90;
    case "deduplicating":
      return 72;
    case "synthesizing":
      return 48;
    case "clustering":
      return 18;
    case "pending":
    default:
      return 5;
  }
}

export default function SynthesisRunCard({ run, activeProgress }: { run: SynthesisRun; activeProgress?: number }) {
  const progress = Math.max(activeProgress ?? 0, getStatusProgress(run.status));

  return (
    <article className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Run {run.id.slice(0, 8)}</p>
        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium">{run.status}</span>
      </div>

      <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
        {formatDate(run.created_at)} · {run.signal_count} signals · {run.feature_request_count} feature requests
      </p>

      <div className="mt-2">
        <SynthesisProgressBar value={progress} />
      </div>
    </article>
  );
}
