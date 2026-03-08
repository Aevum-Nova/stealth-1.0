import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getDashboardStats } from "@/api/dashboard";
import { runSynthesis } from "@/api/synthesis";
import SourceBreakdownChart from "@/components/dashboard/SourceBreakdownChart";
import PriorityDistribution from "@/components/dashboard/PriorityDistribution";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import StatsGrid from "@/components/dashboard/StatsGrid";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventStream } from "@/hooks/use-event-stream";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { events } = useEventStream();

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 60_000
  });

  const runMutation = useMutation({
    mutationFn: () => runSynthesis("incremental"),
    onSuccess: () => {
      navigate("/synthesis");
    }
  });

  const activities = useMemo(
    () =>
      events.slice(0, 8).map((event, index) => ({
        id: `${event.event}-${index}-${event.timestamp}`,
        label: `${event.event.replaceAll("_", " ")} · ${JSON.stringify(event.data).slice(0, 120)}`,
        timestamp: event.timestamp
      })),
    [events]
  );

  if (statsQuery.isLoading) {
    return <LoadingSpinner label="Loading dashboard" />;
  }

  if (statsQuery.isError || !statsQuery.data?.data) {
    return <EmptyState title="Dashboard unavailable" description="Could not load aggregate stats." />;
  }

  const stats = statsQuery.data.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
          <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
            Monitor ingestion and synthesis at a glance.
          </p>
        </div>
        <button
          className="rounded-lg bg-[var(--action-primary)] px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)]"
          onClick={() => runMutation.mutate()}
        >
          Run Synthesis
        </button>
      </div>

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <SourceBreakdownChart data={stats.sources_breakdown} />
        <PriorityDistribution data={stats.feature_requests_by_priority} />
      </div>

      <RecentActivityFeed activities={activities} />
    </div>
  );
}
