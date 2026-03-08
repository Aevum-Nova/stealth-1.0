import type { ImpactMetrics } from "@/types/feature-request";

export default function ImpactMetricsDisplay({ metrics }: { metrics?: ImpactMetrics | null }) {
  if (!metrics) {
    return <p className="text-[13px] text-[var(--ink-soft)]">No metrics available.</p>;
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-[13px]">
      <p>
        <strong>{metrics.signal_count}</strong> signals · <strong>{metrics.unique_customers}</strong> customers · <strong>{metrics.unique_companies}</strong> companies
      </p>
      <p className="mt-1 text-[var(--ink-soft)]">
        Avg urgency {metrics.avg_urgency_score.toFixed(2)} / Trend {metrics.trend_direction}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(metrics.source_breakdown).map(([source, count]) => (
          <span key={source} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium">
            {source}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}
