import { timeAgo } from "@/lib/utils";

interface Activity {
  id: string;
  label: string;
  timestamp: number;
}

function getEventDotClass(label: string): string {
  if (label.includes("synthesis")) return "bg-violet-500";
  if (label.includes("signal") || label.includes("ingest")) return "bg-blue-500";
  if (label.includes("connector")) return "bg-emerald-500";
  if (label.includes("feature")) return "bg-amber-500";
  return "bg-[var(--ink-muted)]";
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
              <span className={`size-2 shrink-0 rounded-full ${getEventDotClass(activity.label)}`} />
              <p className="min-w-0 flex-1 truncate text-[13px]">{activity.label}</p>
              <time className="shrink-0 text-[12px] tabular-nums text-[var(--ink-muted)]">
                {timeAgo(new Date(activity.timestamp).toISOString())}
              </time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
