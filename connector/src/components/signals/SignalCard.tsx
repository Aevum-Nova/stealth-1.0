import type { Signal } from "@/types/signal";
import { formatSourceLabel } from "@/lib/utils";

export default function SignalCard({ signal }: { signal: Signal }) {
  return (
    <article className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold capitalize">{formatSourceLabel(signal.source)}</p>
        <span className="text-[11px] text-[var(--ink-soft)]">{signal.status}</span>
      </div>
      <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{signal.structured_summary ?? "No summary"}</p>
    </article>
  );
}
