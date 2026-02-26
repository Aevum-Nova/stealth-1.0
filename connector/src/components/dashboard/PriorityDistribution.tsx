import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  critical: "#bf2b38",
  high: "#d94f04",
  medium: "#a86800",
  low: "#35524a"
};

export default function PriorityDistribution({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <section className="panel elevated h-80 p-4">
      <h3 className="mb-3 text-lg">Priority Distribution</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie data={items} dataKey="value" nameKey="name" outerRadius={95}>
            {items.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? "#777"} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </section>
  );
}
