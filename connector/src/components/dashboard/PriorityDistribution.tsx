import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: "#ef4444", label: "Critical" },
  high: { color: "#f97316", label: "High" },
  medium: { color: "#eab308", label: "Medium" },
  low: { color: "#22c55e", label: "Low" },
};

export default function PriorityDistribution({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data).map(([name, value]) => ({
    name,
    value,
    color: PRIORITY_CONFIG[name]?.color ?? "#a3a3a3",
    label: PRIORITY_CONFIG[name]?.label ?? name,
  }));

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="panel flex flex-col p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold tracking-tight">Priority Distribution</h3>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Feature requests by priority level</p>
      </div>
      <div className="flex flex-1 items-center gap-8">
        <div className="size-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={80}
                strokeWidth={2}
                stroke="var(--surface)"
              >
                {items.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  backgroundColor: "var(--surface)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  boxShadow: "0 4px 12px var(--shadow-soft)",
                  padding: "8px 12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-3">
          {items.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[13px] font-medium">{item.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                  {total > 0 ? `${Math.round((item.value / total) * 100)}%` : "0%"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
