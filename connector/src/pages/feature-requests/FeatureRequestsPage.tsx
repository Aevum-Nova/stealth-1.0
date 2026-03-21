import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, ChevronDown, Play, RotateCw } from "lucide-react";

import FeatureRequestTable from "@/components/feature-requests/FeatureRequestTable";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFeatureRequestActions, useFeatureRequests } from "@/hooks/use-feature-requests";
import { useRunSynthesis } from "@/hooks/use-synthesis";
import type { FeatureRequestFilters } from "@/types/feature-request";

/** Default toolbar height before measure (filters collapsed) */
const TOOLBAR_FALLBACK_PX = 72;

function fromSearchParams(params: URLSearchParams): FeatureRequestFilters {
  return {
    page: params.get("page") ? Number(params.get("page")) : 1,
    limit: params.get("limit") ? Number(params.get("limit")) : 50,
    status: (params.get("status") || undefined) as any,
    type: (params.get("type") || undefined) as any,
    priority: (params.get("priority") || undefined) as any,
    min_score: params.get("min_score") ? Number(params.get("min_score")) : undefined,
    sort: params.get("sort") || "priority_score",
    order: (params.get("order") as "asc" | "desc" | null) || "desc"
  };
}

function FilterDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isActive = value !== "";
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex min-w-[8.5rem] items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[12px] font-medium outline-none transition-colors focus:outline-none focus-visible:border-[var(--focus-border)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
          isActive
            ? "border-[var(--action-primary)] bg-[var(--action-primary)] text-white"
            : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-soft)] hover:border-[var(--line-muted)]"
        }`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isActive ? "text-white/80" : "text-[var(--ink-muted)]"} ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-full overflow-hidden rounded-md border border-[var(--line)] bg-white shadow-lg">
          {options.map((option) => {
            const selectedOption = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`flex w-full items-center px-2.5 py-2 text-left text-[12px] transition-colors ${
                  selectedOption
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--ink)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.blur();
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function FeatureRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => fromSearchParams(searchParams), [searchParams]);

  const query = useFeatureRequests(filters);
  const actions = useFeatureRequestActions();
  const runMutation = useRunSynthesis({
    onSuccess: () => navigate("/synthesis")
  });
  const [openConfirm, setOpenConfirm] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeightPx, setToolbarHeightPx] = useState(TOOLBAR_FALLBACK_PX);

  const hasActiveFilters = !!(filters.status || filters.type || filters.priority || filters.min_score);

  useLayoutEffect(() => {
    if (query.isLoading || query.isError) return;
    const el = toolbarRef.current;
    if (!el) return;
    const measure = () => setToolbarHeightPx(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showFilters, query.isLoading, query.isError]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  function handleSort(field: string) {
    const next = new URLSearchParams(searchParams);
    if (filters.sort === field) {
      next.set("order", filters.order === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("order", "desc");
    }
    setSearchParams(next);
  }

  if (query.isPending && !query.data) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-[var(--surface)]">
        <LoadingSpinner label="Loading feature requests" />
      </div>
    );
  }

  if (query.isError && !query.data) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-[var(--surface)] p-6">
        <EmptyState title="Feature requests unavailable" description="Could not load feature requests." />
      </div>
    );
  }

  const rows = query.data?.data ?? [];
  const total = (query.data as any)?.total ?? rows.length;

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 flex-1 bg-[var(--surface)]">
      {/* Full-viewport spreadsheet scroll layer (grid extends edge-to-edge under toolbar) */}
      <div
        className="absolute inset-0 overflow-auto"
        style={{ scrollPaddingTop: toolbarHeightPx }}
      >
        <div
          className="min-h-full w-full min-w-0"
          style={{ paddingTop: toolbarHeightPx }}
        >
          {rows.length === 0 ? (
            <div className="flex min-h-[50vh] items-center justify-center px-6">
              <EmptyState title="No feature requests" description="Run synthesis or adjust filters." />
            </div>
          ) : (
            <FeatureRequestTable
              fullBleed
              stickyHeaderOffsetPx={toolbarHeightPx}
              items={rows}
              onDelete={(id) => actions.delete.mutate(id)}
              sort={filters.sort}
              order={filters.order}
              onSort={handleSort}
            />
          )}
        </div>
      </div>

      {/* Floating toolbar — fixed to top of main; grid scrolls underneath */}
      <div
        ref={toolbarRef}
        className="pointer-events-none absolute left-0 right-0 top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]/92 px-3 py-2 shadow-[0_4px_24px_var(--shadow-soft)] backdrop-blur-md sm:px-4"
      >
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="truncate text-[14px] font-semibold tracking-tight text-[var(--ink)] sm:text-[15px]">
                Feature Requests
              </h2>
              <span className="shrink-0 rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--ink-muted)]">
                {total}
              </span>
              {query.isFetching ? (
                <span className="shrink-0 text-[11px] font-medium text-[var(--ink-muted)]">
                  Updating…
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  hasActiveFilters
                    ? "border-[var(--action-primary)] text-[var(--action-primary)]"
                    : "border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--line-muted)]"
                }`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-3 w-3" />
                Filter
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:border-[var(--line-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setOpenConfirm(true)}
                disabled={runMutation.isPending}
              >
                <RotateCw className="h-3 w-3" />
                Re-Synthesize
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--action-primary)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => runMutation.mutate({ mode: "incremental" })}
                disabled={runMutation.isPending}
              >
                <Play className="h-3 w-3" />
                Run Synthesis
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)]/60 pt-2">
              <FilterDropdown
                value={filters.status ?? ""}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "reviewed", label: "Reviewed" },
                  { value: "approved", label: "Approved" },
                  { value: "merged", label: "Merged" },
                  { value: "sent_to_agent", label: "Sent to Agent" },
                ]}
                onChange={(v) => setFilter("status", v)}
              />
              <FilterDropdown
                value={filters.type ?? ""}
                options={[
                  { value: "", label: "All types" },
                  { value: "feature", label: "Feature" },
                  { value: "bug_fix", label: "Bug Fix" },
                  { value: "improvement", label: "Improvement" },
                  { value: "integration", label: "Integration" },
                  { value: "ux_change", label: "UX Change" },
                ]}
                onChange={(v) => setFilter("type", v)}
              />
              <FilterDropdown
                value={filters.priority ?? ""}
                options={[
                  { value: "", label: "All priorities" },
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]}
                onChange={(v) => setFilter("priority", v)}
              />
              <input
                className="w-[5.5rem] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] text-[var(--ink-soft)] placeholder:text-[var(--ink-muted)] hover:border-[var(--line-muted)]"
                type="number"
                value={filters.min_score ?? ""}
                onChange={(e) => setFilter("min_score", e.target.value)}
                placeholder="Min score"
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  className="text-[11px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("status");
                    next.delete("type");
                    next.delete("priority");
                    next.delete("min_score");
                    setSearchParams(next);
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={openConfirm}
        title="Run full re-synthesis"
        description="This will delete all draft feature requests and re-analyze all completed signals."
        confirmLabel="Run full synthesis"
        onCancel={() => setOpenConfirm(false)}
        onConfirm={() => {
          runMutation.mutate({ mode: "full" });
          setOpenConfirm(false);
        }}
      />
    </div>
  );
}
