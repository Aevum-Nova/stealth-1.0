import { timeAgo } from "@/lib/utils";

interface Activity {
  id: string;
  label: string;
  timestamp: number;
}

export default function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <section className="panel p-4">
      <h3 className="mb-3 text-[13px] font-medium">Recent Activity</h3>
      <div className="space-y-1">
        {activities.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-soft)]">No recent activity yet.</p>
        ) : (
          activities.map((activity) => (
            <article key={activity.id} className="flex items-baseline justify-between gap-4 rounded-lg px-3 py-2 hover:bg-[var(--accent-soft)] transition-colors">
              <p className="min-w-0 truncate text-[13px]">{activity.label}</p>
              <p className="shrink-0 text-[12px] text-[var(--ink-muted)]">{timeAgo(new Date(activity.timestamp).toISOString())}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
