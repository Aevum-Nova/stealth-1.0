import type { DashboardStats } from "@/api/dashboard";
import { formatNumber } from "@/lib/utils";

export default function StatsGrid({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Total Signals", value: formatNumber(stats.total_signals) },
    { label: "Feature Requests", value: formatNumber(stats.total_feature_requests) },
    { label: "Active Connectors", value: formatNumber(stats.active_connectors) },
    { label: "Since Last Synthesis", value: formatNumber(stats.signals_since_last_synthesis) }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="panel p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{card.label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
