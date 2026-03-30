import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SignalFilters from "@/components/signals/SignalFilters";
import SignalSearchBar from "@/components/signals/SignalSearchBar";
import SignalTable from "@/components/signals/SignalTable";
import { useSignalSearch, useSignals } from "@/hooks/use-signals";
import type { SignalFilters as SignalFiltersType } from "@/types/signal";

function fromSearchParams(params: URLSearchParams): SignalFiltersType {
  return {
    page: params.get("page") ? Number(params.get("page")) : 1,
    limit: params.get("limit") ? Number(params.get("limit")) : 20,
    source: (params.get("source") || undefined) as any,
    status: (params.get("status") || undefined) as any,
    sentiment: (params.get("sentiment") || undefined) as any,
    urgency: (params.get("urgency") || undefined) as any,
    synthesized: params.get("synthesized") ? params.get("synthesized") === "true" : undefined,
    since: params.get("since") || undefined,
    sort: params.get("sort") || "created_at",
    order: (params.get("order") as "asc" | "desc" | null) || "desc"
  };
}

export default function SignalsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  const filters = useMemo(() => fromSearchParams(searchParams), [searchParams]);
  const signalsQuery = useSignals(filters);
  const searchQuery = useSignalSearch(search);
  const normalizedSearch = search.trim();
  const isSearchActive = normalizedSearch.length >= 2;
  const isSearchLoading = isSearchActive && searchQuery.isLoading && !searchQuery.data;
  const isSearchError = isSearchActive && searchQuery.isError;

  const activeRows = isSearchActive ? searchQuery.data?.data.map((item) => item.signal) ?? [] : signalsQuery.data?.data ?? [];

  if (signalsQuery.isLoading) {
    return <LoadingSpinner fill label="Loading signals" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Signals</h2>
        <p className="text-[13px] text-[var(--ink-soft)]">Inspect ingested evidence with filtering and semantic search.</p>
      </div>

      <SignalFilters
        filters={filters}
        onChange={(next) => {
          const params = new URLSearchParams();
          Object.entries(next).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
              params.set(key, String(value));
            }
          });
          setSearchParams(params);
        }}
      />

      <SignalSearchBar value={search} onChange={setSearch} />
      {normalizedSearch.length > 0 && !isSearchActive ? (
        <p className="text-[12px] text-[var(--ink-soft)]">Type at least 2 characters to run search.</p>
      ) : null}

      {isSearchLoading ? (
        <LoadingSpinner label="Searching signals" />
      ) : isSearchError ? (
        <EmptyState title="Search failed" description="Could not run signal search. Try again." />
      ) : activeRows.length === 0 ? (
        <EmptyState title="No signals found" description="Try changing filters or searching with another phrase." />
      ) : (
        <SignalTable rows={activeRows} onOpen={(signal) => navigate(`/signals/${signal.id}`)} />
      )}

      {!isSearchActive ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--ink-soft)]">
          <span>
            Showing {(signalsQuery.data?.data?.length ?? 0).toString()} of {signalsQuery.data?.pagination.total ?? 0}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
              disabled={(filters.page ?? 1) <= 1}
              onClick={() => {
                const next = { ...filters, page: Math.max((filters.page ?? 1) - 1, 1) };
                const params = new URLSearchParams();
                Object.entries(next).forEach(([key, value]) => {
                  if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
                });
                setSearchParams(params);
              }}
            >
              Prev
            </button>
            <button
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
              onClick={() => {
                const next = { ...filters, page: (filters.page ?? 1) + 1 };
                const params = new URLSearchParams();
                Object.entries(next).forEach(([key, value]) => {
                  if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
                });
                setSearchParams(params);
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
