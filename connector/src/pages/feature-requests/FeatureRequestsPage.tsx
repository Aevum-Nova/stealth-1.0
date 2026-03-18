import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import FeatureRequestList from "@/components/feature-requests/FeatureRequestList";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useFeatureRequestActions, useFeatureRequests } from "@/hooks/use-feature-requests";
import { useRunSynthesis } from "@/hooks/use-synthesis";
import type { FeatureRequestFilters } from "@/types/feature-request";

function fromSearchParams(params: URLSearchParams): FeatureRequestFilters {
  return {
    page: params.get("page") ? Number(params.get("page")) : 1,
    limit: params.get("limit") ? Number(params.get("limit")) : 20,
    status: (params.get("status") || undefined) as any,
    type: (params.get("type") || undefined) as any,
    priority: (params.get("priority") || undefined) as any,
    min_score: params.get("min_score") ? Number(params.get("min_score")) : undefined,
    sort: params.get("sort") || "priority_score",
    order: (params.get("order") as "asc" | "desc" | null) || "desc"
  };
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

  if (query.isLoading) {
    return <LoadingSpinner label="Loading feature requests" />;
  }

  if (query.isError) {
    return <EmptyState title="Feature requests unavailable" description="Could not load feature requests." />;
  }

  const rows = query.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Feature Requests</h2>
          <p className="text-[13px] text-[var(--ink-soft)]">Review and manage synthesized product requests.</p>
        </div>
        <button
          className="rounded-lg bg-[var(--action-primary)] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => runMutation.mutate({ mode: "incremental" })}
          disabled={runMutation.isPending}
        >
          Run Synthesis
        </button>
      </div>

      <div className="panel grid grid-cols-1 gap-2 p-3 md:grid-cols-6">
        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
          value={filters.status ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const next = new URLSearchParams(searchParams);
            if (value) next.set("status", value);
            else next.delete("status");
            setSearchParams(next);
          }}
        >
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed</option>
          <option value="merged">Merged</option>
        </select>

        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
          value={filters.type ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const next = new URLSearchParams(searchParams);
            if (value) next.set("type", value);
            else next.delete("type");
            setSearchParams(next);
          }}
        >
          <option value="">All type</option>
          <option value="feature">Feature</option>
          <option value="bug_fix">Bug Fix</option>
          <option value="improvement">Improvement</option>
          <option value="integration">Integration</option>
          <option value="ux_change">UX Change</option>
        </select>

        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
          value={filters.priority ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const next = new URLSearchParams(searchParams);
            if (value) next.set("priority", value);
            else next.delete("priority");
            setSearchParams(next);
          }}
        >
          <option value="">All priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <input
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
          type="number"
          value={filters.min_score ?? ""}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams);
            if (event.target.value) next.set("min_score", event.target.value);
            else next.delete("min_score");
            setSearchParams(next);
          }}
          placeholder="Min score"
        />

        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
          value={filters.sort ?? "priority_score"}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams);
            next.set("sort", event.target.value);
            setSearchParams(next);
          }}
        >
          <option value="priority_score">Sort by priority score</option>
          <option value="created_at">Sort by created at</option>
          <option value="updated_at">Sort by updated at</option>
        </select>

        <select
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-[13px]"
          value={filters.order ?? "desc"}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams);
            next.set("order", event.target.value);
            setSearchParams(next);
          }}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No feature requests" description="Run synthesis or adjust filters." />
      ) : (
        <FeatureRequestList
          items={rows}
          onDelete={(id) => actions.delete.mutate(id)}
        />
      )}

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

      <button
        className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setOpenConfirm(true)}
        disabled={runMutation.isPending}
      >
        Run Full Re-Synthesis
      </button>
    </div>
  );
}
