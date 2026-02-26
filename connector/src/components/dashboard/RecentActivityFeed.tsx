import { timeAgo } from "@/lib/utils";

interface Activity {
  id: string;
  label: string;
  timestamp: number;
}

export default function RecentActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <section className="panel elevated p-4">
      <h3 className="mb-3 text-lg">Recent Activity</h3>
      <div className="space-y-2">
        {activities.length === 0 ? (
          <p className="text-sm text-[var(--ink-soft)]">No recent activity yet.</p>
        ) : (
          activities.map((activity) => (
            <article key={activity.id} className="rounded-lg border border-[var(--line)] bg-gray-50 px-3 py-2">
              <p className="text-sm">{activity.label}</p>
              <p className="text-xs text-[var(--ink-soft)]">{timeAgo(new Date(activity.timestamp).toISOString())}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
