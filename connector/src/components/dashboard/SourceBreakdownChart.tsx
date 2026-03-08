import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SourceBreakdownChart({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data).map(([source, count]) => ({ source, count }));

  return (
    <section className="panel h-72 p-4">
      <h3 className="mb-3 text-[13px] font-medium">Source Breakdown</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={items}>
          <XAxis dataKey="source" tick={{ fontSize: 12, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={{ stroke: "var(--line)" }} />
          <YAxis tick={{ fontSize: 12, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={{ stroke: "var(--line)" }} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              backgroundColor: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              boxShadow: "0 2px 8px var(--shadow-soft)"
            }}
          />
          <Bar dataKey="count" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
