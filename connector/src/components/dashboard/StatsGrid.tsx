import type { DashboardStats } from "@/api/dashboard";
import { formatNumber } from "@/lib/utils";

export default function StatsGrid({ stats }: { stats: DashboardStats }) {
  const cards = [
    { label: "Total Signals", value: formatNumber(stats.total_signals) },
    { label: "Feature Requests", value: formatNumber(stats.total_feature_requests) },
    { label: "Active Connectors", value: formatNumber(stats.active_connectors) },
    { label: "Signals Since Last Synthesis", value: formatNumber(stats.signals_since_last_synthesis) }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.label} className="panel elevated p-4">
          <p className="text-sm text-[var(--ink-soft)]">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
