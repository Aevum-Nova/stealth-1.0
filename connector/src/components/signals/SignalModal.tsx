import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useSignal } from "@/hooks/use-signals";
import { formatDate, formatSourceLabel } from "@/lib/utils";

interface SignalModalProps {
  signalId: string;
  onClose: () => void;
}

export default function SignalModal({ signalId, onClose }: SignalModalProps) {
  const { data, isLoading, isError } = useSignal(signalId);
  const signal = data?.data;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight">Signal Detail</h2>
            {signal && (
              <p className="mt-1 truncate text-[12px] text-[var(--ink-muted)]">
                {formatSourceLabel(signal.source)} · {signal.source_data_type} · {formatDate(signal.created_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {signal && (
              <Link
                to={`/signals/${signalId}`}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--accent-soft)]"
              >
                Open page
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            <button
              className="rounded-md p-1 text-[var(--ink-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {isLoading && <LoadingSpinner label="Loading signal" />}

        {isError && (
          <p className="text-[13px] text-[var(--ink-soft)]">Could not load this signal.</p>
        )}

        {signal && (
          <div className="space-y-4">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
                {signal.status}
              </span>
              {signal.sentiment && (
                <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
                  {signal.sentiment}
                </span>
              )}
              {signal.urgency && (
                <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
                  {signal.urgency} urgency
                </span>
              )}
            </div>

            {/* Structured Summary */}
            {signal.structured_summary && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Summary</h3>
                <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">{signal.structured_summary}</p>
              </section>
            )}

            {/* Entities */}
            {signal.entities.length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Entities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {signal.entities.map((entity, idx) => (
                    <span
                      key={`${entity.type}-${idx}`}
                      className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium"
                    >
                      {entity.type}: {entity.value}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Raw Content */}
            <section>
              <h3 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Content</h3>
              <div className="space-y-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                {signal.original_text && <p>{signal.original_text}</p>}
                {signal.transcript && <p>{signal.transcript}</p>}
                {signal.extracted_text && <p>{signal.extracted_text}</p>}
                {!signal.original_text && !signal.transcript && !signal.extracted_text && (
                  <p className="text-[var(--ink-muted)]">No raw content available.</p>
                )}
                {signal.source_data_type === "image" && signal.raw_artifact_r2_key && (
                  <p className="text-[12px] text-[var(--ink-muted)]">Image key: {signal.raw_artifact_r2_key}</p>
                )}
              </div>
            </section>

            {/* Source Metadata */}
            {signal.source_metadata && Object.keys(signal.source_metadata).length > 0 && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Source Metadata</h3>
                <pre className="overflow-x-auto rounded-lg bg-[var(--surface-subtle)] p-3 text-[12px] text-[var(--ink-soft)]">
                  {JSON.stringify(signal.source_metadata, null, 2)}
                </pre>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
