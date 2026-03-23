import { useCallback, useState } from "react";

import SignalModal from "@/components/signals/SignalModal";
import type { SupportingEvidence } from "@/types/feature-request";

export default function EvidencePanel({
  evidence,
  featureRequestId,
}: {
  evidence: SupportingEvidence[];
  featureRequestId?: string;
}) {
  const [count, setCount] = useState(5);
  const [activeSignalId, setActiveSignalId] = useState<string | null>(null);
  const closeModal = useCallback(() => setActiveSignalId(null), []);

  if (evidence.length === 0) {
    return <p className="text-[13px] text-[var(--ink-soft)]">No supporting evidence.</p>;
  }

  const visible = evidence.slice(0, count);

  return (
    <>
      <div className="space-y-2">
        {visible.map((item) => (
          <article
            key={item.signal_id}
            role="button"
            tabIndex={0}
            className="cursor-pointer rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-[13px] transition-colors hover:border-[var(--line-muted)] hover:bg-[var(--surface-hover)]"
            onClick={() => setActiveSignalId(item.signal_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActiveSignalId(item.signal_id);
              }
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--ink-muted)]">
              {item.source} · {item.customer_company ?? "Unknown company"} · {item.author_name ?? "Unknown author"}
            </p>
            <p className="mt-1.5 text-[14px] text-[var(--ink-soft)]">"{item.representative_quote}"</p>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">Relevance {item.relevance_score.toFixed(2)}</p>
          </article>
        ))}
        {count < evidence.length && (
          <button
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]"
            onClick={() => setCount((v) => v + 5)}
          >
            Show more ({evidence.length - count} remaining)
          </button>
        )}
      </div>

      {activeSignalId && (
        <SignalModal
          signalId={activeSignalId}
          onClose={closeModal}
          backToPath={featureRequestId ? `/feature-requests/${featureRequestId}` : undefined}
          backToLabel={featureRequestId ? "Back to Feature Request" : undefined}
        />
      )}
    </>
  );
}
