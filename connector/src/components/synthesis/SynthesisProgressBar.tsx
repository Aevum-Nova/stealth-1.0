export default function SynthesisProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(Math.round(value), 100));
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-[#ece4d2]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[var(--ink-soft)]">{pct}%</p>
    </div>
  );
}
