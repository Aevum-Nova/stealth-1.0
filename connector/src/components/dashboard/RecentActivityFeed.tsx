import { timeAgo } from "@/lib/utils";

interface Activity {
  id: string;
  label: string;
  kind: string;
  status?: string;
  timestamp: string;
}

function getDotColor(kind: string, status?: string): string {
  if (status === "failed") return "bg-rose-500";
  if (status === "running" || status === "pending") return "bg-amber-400";
  if (kind === "synthesis") return "bg-violet-500";
  if (kind === "ingestion") return "bg-blue-500";
  if (kind === "signal") return "bg-emerald-500";
  return "bg-[var(--ink-muted)]";
}

function getStatusBadge(status?: string) {
  if (!status || status === "completed") return null;
  const colors: Record<string, string> = {
    running: "bg-amber-500/15 text-amber-600",
    pending: "bg-[var(--ink-muted)]/15 text-[var(--ink-muted)]",
    failed: "bg-rose-500/15 text-rose-500",
  };
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <section className="panel p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Recent Activity</h3>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Latest events from your integrations</p>
      </div>
      <div className="space-y-0.5">
        {activities.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--ink-muted)]">
            No recent activity yet.
          </p>
        ) : (
          activities.map((activity) => (
            <article
              key={activity.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <span className={`size-2 shrink-0 rounded-full ${getDotColor(activity.kind, activity.status)}`} />
              <p className="min-w-0 flex-1 truncate text-[13px]">{activity.label}</p>
              {getStatusBadge(activity.status)}
              <time className="shrink-0 text-[12px] tabular-nums text-[var(--ink-muted)]">
                {timeAgo(activity.timestamp)}
              </time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
