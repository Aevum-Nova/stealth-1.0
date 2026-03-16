import { Activity, Cable, Lightbulb, Zap } from "lucide-react";

import type { DashboardStats } from "@/api/dashboard";
import { formatNumber, timeAgo } from "@/lib/utils";

function buildCards(stats: DashboardStats) {
  return [
    {
      label: "Total Signals",
      value: formatNumber(stats.total_signals),
      detail:
        stats.signals_pending > 0
          ? `${formatNumber(stats.signals_pending)} pending`
          : "All processed",
      icon: Activity,
      iconClass: "bg-blue-500/10 text-blue-500",
    },
    {
      label: "Feature Requests",
      value: formatNumber(stats.total_feature_requests),
      detail:
        (stats.feature_requests_by_priority.critical ?? 0) > 0
          ? `${formatNumber(stats.feature_requests_by_priority.critical)} critical`
          : "No critical items",
      icon: Lightbulb,
      iconClass: "bg-violet-500/10 text-violet-500",
    },
    {
      label: "Active Connectors",
      value: formatNumber(stats.active_connectors),
      detail: "Integrations live",
      icon: Cable,
      iconClass: "bg-emerald-500/10 text-emerald-500",
    },
    {
      label: "Since Last Synthesis",
      value: formatNumber(stats.signals_since_last_synthesis),
      detail: stats.last_synthesis_at
        ? `Last run ${timeAgo(stats.last_synthesis_at)}`
        : "No synthesis yet",
      icon: Zap,
      iconClass: "bg-amber-500/10 text-amber-500",
    },
  ];
}

export default function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {buildCards(stats).map((card) => (
        <article key={card.label} className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-[var(--ink-soft)]">{card.label}</p>
            <div className={`flex size-9 items-center justify-center rounded-lg ${card.iconClass}`}>
              <card.icon className="size-[18px]" />
            </div>
          </div>
          <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight">{card.value}</p>
          <p className="mt-1.5 text-[12px] text-[var(--ink-muted)]">{card.detail}</p>
        </article>
      ))}
    </div>
  );
}
