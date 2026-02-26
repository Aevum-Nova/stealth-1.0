import type { ImpactMetrics } from "@/types/feature-request";

export default function ImpactMetricsDisplay({ metrics }: { metrics?: ImpactMetrics | null }) {
  if (!metrics) {
    return <p className="text-sm text-[var(--ink-soft)]">No metrics available.</p>;
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[#fdf7ed] p-3 text-sm">
      <p>
        <strong>{metrics.signal_count}</strong> signals · <strong>{metrics.unique_customers}</strong> customers · <strong>{metrics.unique_companies}</strong> companies
      </p>
      <p className="mt-1 text-[var(--ink-soft)]">
        Avg urgency {metrics.avg_urgency_score.toFixed(2)} / Trend {metrics.trend_direction}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(metrics.source_breakdown).map(([source, count]) => (
          <span key={source} className="rounded-full bg-[#ece5d6] px-2 py-1 text-xs">
            {source}: {count}
          </span>
        ))}
      </div>
    </div>
  );
}
