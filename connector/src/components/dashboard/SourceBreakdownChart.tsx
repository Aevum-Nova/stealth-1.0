import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SourceBreakdownChart({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data).map(([source, count]) => ({ source, count }));

  return (
    <section className="panel elevated h-80 p-4">
      <h3 className="mb-3 text-lg">Source Breakdown</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={items}>
          <XAxis dataKey="source" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#d94f04" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
