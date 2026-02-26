import { useState } from "react";
import { Link } from "react-router-dom";

import type { SupportingEvidence } from "@/types/feature-request";

export default function EvidencePanel({ evidence }: { evidence: SupportingEvidence[] }) {
  const [count, setCount] = useState(5);

  if (evidence.length === 0) {
    return <p className="text-sm text-[var(--ink-soft)]">No supporting evidence.</p>;
  }

  const visible = evidence.slice(0, count);

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <article key={item.signal_id} className="rounded-lg border border-[var(--line)] bg-[#fef9ef] p-3 text-sm">
          <p className="text-xs text-[var(--ink-soft)]">
            {item.source} · {item.customer_company ?? "Unknown company"} · {item.author_name ?? "Unknown author"}
          </p>
          <p className="mt-1">"{item.representative_quote}"</p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">Relevance {item.relevance_score.toFixed(2)}</p>
          <Link to={`/signals/${item.signal_id}`} className="mt-2 inline-block text-xs text-[var(--accent)]">
            Open signal →
          </Link>
        </article>
      ))}
      {count < evidence.length ? (
        <button className="rounded-lg border border-[var(--line)] px-3 py-1 text-sm" onClick={() => setCount((v) => v + 5)}>
          Show more ({evidence.length - count} remaining)
        </button>
      ) : null}
    </div>
  );
}
