import type { SynthesisRun } from "@/api/synthesis";
import { formatDate } from "@/lib/utils";

import SynthesisProgressBar from "@/components/synthesis/SynthesisProgressBar";

export default function SynthesisRunCard({ run, activeProgress }: { run: SynthesisRun; activeProgress?: number }) {
  const progress = activeProgress ?? (run.status === "completed" ? 100 : 25);

  return (
    <article className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Run {run.id.slice(0, 8)}</p>
        <span className="rounded-full bg-[#ece5d6] px-2 py-1 text-xs">{run.status}</span>
      </div>

      <p className="mt-1 text-xs text-[var(--ink-soft)]">
        {formatDate(run.created_at)} · {run.signal_count} signals · {run.feature_request_count} feature requests
      </p>

      <div className="mt-2">
        <SynthesisProgressBar value={progress} />
      </div>
    </article>
  );
}
