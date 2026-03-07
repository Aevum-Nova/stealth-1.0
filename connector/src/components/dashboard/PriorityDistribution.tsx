import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e"
};

export default function PriorityDistribution({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <section className="panel h-72 p-4">
      <h3 className="mb-3 text-[13px] font-medium">Priority Distribution</h3>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" outerRadius={80} strokeWidth={1.5}>
            {items.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? "#a3a3a3"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--line)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </section>
  );
}
