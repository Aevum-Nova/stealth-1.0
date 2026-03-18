import { useMemo, useState } from "react";

import { joinSlackChannels } from "@/api/connectors";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useSlackChannels } from "@/hooks/use-connectors";

interface SlackChannelPickerProps {
  connectorId: string;
  initialChannelIds?: string[];
  onSave: (channelIds: string[]) => void;
  saving?: boolean;
}

export default function SlackChannelPicker({
  connectorId,
  initialChannelIds,
  onSave,
  saving,
}: SlackChannelPickerProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialChannelIds ?? []));
  const [joining, setJoining] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelsQuery = useSlackChannels(connectorId);
  const channels = channelsQuery.data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter(
      (ch) => ch.name.toLowerCase().includes(q) || ch.topic.toLowerCase().includes(q)
    );
  }, [channels, search]);

  const toggle = (id: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    setJoining(true);
    setError(null);
    try {
      await joinSlackChannels(connectorId, ids);
      onSave(ids);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join channels");
    } finally {
      setJoining(false);
    }
  };

  if (channelsQuery.isLoading) {
    return <LoadingSpinner label="Loading channels from Slack..." />;
  }

  if (channelsQuery.isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
        Failed to load channels. Make sure the Slack connector is authorized.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-[var(--ink-soft)]">
        Select the channels you want to monitor. The bot will automatically join the selected channels.
      </p>

      {/* Search + count inline */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] py-2 pl-9 pr-20 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
          placeholder="Search channels..."
        />
        {selected.size > 0 ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--ink-muted)]">
            {selected.size} selected
          </span>
        ) : null}
      </div>

      {/* Channel list */}
      <div className="max-h-80 divide-y divide-[var(--line)] overflow-y-auto rounded-lg border border-[var(--line)]">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--ink-muted)]">
            {search ? "No channels match your search." : "No channels found in this workspace."}
          </p>
        ) : null}
        {filtered.map((ch) => {
          const isSelected = selected.has(ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                isSelected
                  ? "bg-[var(--accent-soft)]"
                  : "hover:bg-[var(--surface)]"
              }`}
              onClick={() => toggle(ch.id)}
            >
              {/* Checkbox */}
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  isSelected
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-[var(--surface)]"
                }`}
              >
                {isSelected ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </div>

              {/* Channel info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-[var(--ink-muted)]">
                    {ch.is_private ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    ) : (
                      <span className="font-bold">#</span>
                    )}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--ink)]">{ch.name}</span>
                </div>
                {ch.topic ? (
                  <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">{ch.topic}</p>
                ) : null}
              </div>

              {/* Member count */}
              <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">
                {ch.num_members}
              </span>
            </button>
          );
        })}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg bg-[var(--action-primary)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:opacity-50"
          disabled={selected.size === 0 || saving || joining}
          onClick={() => void handleSave()}
        >
          {joining || saving ? "Saving..." : saved ? "Channels Saved" : "Save & Join Channels"}
        </button>
        {selected.size > 0 ? (
          <button
            className="text-[12px] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
            onClick={() => setSelected(new Set())}
          >
            Clear all
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
