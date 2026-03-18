import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatSourceLabel } from "@/lib/utils";

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#f97316"];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { source: string; count: number; fill: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div style={{
      fontSize: 12,
      borderRadius: 8,
      backgroundColor: "var(--surface)",
      color: "var(--ink)",
      border: "1px solid var(--line)",
      boxShadow: "0 4px 12px var(--shadow-soft)",
      padding: "8px 12px",
    }}>
      <p style={{ fontWeight: 600 }}>{item.source}</p>
      <p style={{ color: "var(--ink-soft)", marginTop: 2 }}>{item.count} signals</p>
    </div>
  );
}

export default function SourceBreakdownChart({ data }: { data: Record<string, number> }) {
  const items = Object.entries(data).map(([source, count], i) => ({
    source: formatSourceLabel(source),
    count,
    fill: BAR_COLORS[i % BAR_COLORS.length],
  }));

  return (
    <section className="panel flex flex-col p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold tracking-tight">Source Breakdown</h3>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">Signals by integration source</p>
      </div>
      <div className="min-h-0 flex-1" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} barSize={32}>
            <XAxis
              dataKey="source"
              tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {items.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
