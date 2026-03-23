import { Search } from "lucide-react";

export default function SignalSearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="panel flex items-center gap-2 px-3 py-2">
      <Search className="size-4 text-[var(--ink-soft)]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Semantic search signals..."
        className="signal-search-input w-full bg-transparent outline-none"
      />
    </label>
  );
}
