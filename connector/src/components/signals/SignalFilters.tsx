import type { SignalFilters } from "@/types/signal";
import { formatSourceLabel } from "@/lib/utils";

const SOURCES = ["slack", "direct_upload", "api"];
const STATUSES = ["pending", "processing", "completed", "failed"];
const SENTIMENTS = ["positive", "negative", "neutral", "mixed"];
const URGENCIES = ["low", "medium", "high", "critical"];

interface SignalFiltersProps {
  filters: SignalFilters;
  onChange: (next: SignalFilters) => void;
}

export default function SignalFilters({ filters, onChange }: SignalFiltersProps) {
  return (
    <div className="panel grid grid-cols-1 gap-2 p-3 md:grid-cols-3 xl:grid-cols-6">
      <select
        value={filters.source ?? ""}
        onChange={(event) => onChange({ ...filters, source: (event.target.value || undefined) as any })}
        className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
      >
        <option value="">All sources</option>
        {SOURCES.map((source) => (
          <option key={source} value={source}>
            {formatSourceLabel(source)}
          </option>
        ))}
      </select>

      <select
        value={filters.status ?? ""}
        onChange={(event) => onChange({ ...filters, status: (event.target.value || undefined) as any })}
        className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
      >
        <option value="">All statuses</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <select
        value={filters.sentiment ?? ""}
        onChange={(event) => onChange({ ...filters, sentiment: (event.target.value || undefined) as any })}
        className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
      >
        <option value="">All sentiment</option>
        {SENTIMENTS.map((sentiment) => (
          <option key={sentiment} value={sentiment}>
            {sentiment}
          </option>
        ))}
      </select>

      <select
        value={filters.urgency ?? ""}
        onChange={(event) => onChange({ ...filters, urgency: (event.target.value || undefined) as any })}
        className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
      >
        <option value="">All urgency</option>
        {URGENCIES.map((urgency) => (
          <option key={urgency} value={urgency}>
            {urgency}
          </option>
        ))}
      </select>

      <select
        value={filters.synthesized === undefined ? "" : String(filters.synthesized)}
        onChange={(event) => {
          const value = event.target.value;
          onChange({ ...filters, synthesized: value === "" ? undefined : value === "true" });
        }}
        className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
      >
        <option value="">All synthesis states</option>
        <option value="true">Synthesized</option>
        <option value="false">Not synthesized</option>
      </select>

      <input
        type="date"
        value={filters.since ? filters.since.slice(0, 10) : ""}
        onChange={(event) => onChange({ ...filters, since: event.target.value || undefined })}
        className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
      />
    </div>
  );
}
