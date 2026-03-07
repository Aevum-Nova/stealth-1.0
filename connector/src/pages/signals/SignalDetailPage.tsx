import { Link, useParams } from "react-router-dom";

import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFeatureRequests } from "@/hooks/use-feature-requests";
import { useSignal } from "@/hooks/use-signals";
import { formatDate, formatSourceLabel } from "@/lib/utils";

export default function SignalDetailPage() {
  const { id = "" } = useParams();
  const signalQuery = useSignal(id);
  const featureRequestsQuery = useFeatureRequests({ signal_id: id, limit: 50 });

  if (signalQuery.isLoading) {
    return <LoadingSpinner label="Loading signal" />;
  }

  if (signalQuery.isError || !signalQuery.data?.data) {
    return <EmptyState title="Signal not found" description="This signal may have been deleted." />;
  }

  const signal = signalQuery.data.data;
  const linkedFeatureRequests = featureRequestsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <Link to="/signals" className="text-[13px] text-[var(--accent)]">
        ← Back to Signals
      </Link>

      <section className="panel p-4">
        <h2 className="text-xl font-semibold tracking-tight">Signal Detail</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          {signal.id} · {formatSourceLabel(signal.source)} · created {formatDate(signal.created_at)}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <article className="rounded-lg border border-[var(--line)] p-3">
              <h3 className="text-[15px] font-medium">Structured Summary</h3>
              <p className="mt-2 text-[13px] text-[var(--ink-soft)]">{signal.structured_summary ?? "-"}</p>
            </article>

            <article className="rounded-lg border border-[var(--line)] p-3">
              <h3 className="text-[15px] font-medium">Entities</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {signal.entities.length === 0 ? <span className="text-[13px] text-[var(--ink-soft)]">No entities extracted.</span> : null}
                {signal.entities.map((entity, idx) => (
                  <span key={`${entity.type}-${idx}`} className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium">
                    {entity.type}: {entity.value}
                  </span>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-[var(--line)] p-3">
              <h3 className="text-[15px] font-medium">Source Metadata</h3>
              <pre className="mt-2 overflow-x-auto rounded bg-[var(--accent-soft)] p-2 text-[12px]">
                {JSON.stringify(signal.source_metadata, null, 2)}
              </pre>
            </article>
          </div>

          <div className="space-y-3">
            <article className="rounded-lg border border-[var(--line)] p-3">
              <h3 className="text-[15px] font-medium">Raw Content</h3>
              <div className="mt-2 space-y-2 text-[13px] text-[var(--ink-soft)]">
                {signal.original_text ? <p>{signal.original_text}</p> : null}
                {signal.transcript ? <p>{signal.transcript}</p> : null}
                {signal.extracted_text ? <p>{signal.extracted_text}</p> : null}
                {!signal.original_text && !signal.transcript && !signal.extracted_text ? (
                  <p>Raw content is not available in this response.</p>
                ) : null}
                {signal.source_data_type === "image" ? (
                  <p className="text-[12px]">Image key: {signal.raw_artifact_r2_key}</p>
                ) : null}
              </div>
            </article>

            <article className="rounded-lg border border-[var(--line)] p-3">
              <h3 className="text-[15px] font-medium">Referenced Feature Requests</h3>
              <div className="mt-2 space-y-2">
                {linkedFeatureRequests.length === 0 ? (
                  <p className="text-[13px] text-[var(--ink-soft)]">No feature requests reference this signal yet.</p>
                ) : (
                  linkedFeatureRequests.map((item) => (
                    <Link
                      key={item.id}
                      to={`/feature-requests/${item.id}`}
                      className="block rounded-lg border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-[13px]"
                    >
                      {item.title} · {item.priority.toUpperCase()} ({item.priority_score})
                    </Link>
                  ))
                )}
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
