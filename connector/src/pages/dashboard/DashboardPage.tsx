import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { getDashboardStats } from "@/api/dashboard";
import SourceBreakdownChart from "@/components/dashboard/SourceBreakdownChart";
import PriorityDistribution from "@/components/dashboard/PriorityDistribution";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import StatsGrid from "@/components/dashboard/StatsGrid";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventStream } from "@/hooks/use-event-stream";
import { useRunSynthesis } from "@/hooks/use-synthesis";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { events } = useEventStream();

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 60_000
  });

  const runMutation = useRunSynthesis({
    onSuccess: () => navigate("/synthesis")
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            Monitor ingestion and synthesis at a glance.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary)] px-4 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => runMutation.mutate({ mode: "incremental" })}
          disabled={runMutation.isPending}
        >
          <Sparkles className="size-3.5" />
          Run Synthesis
        </button>
      </div>

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SourceBreakdownChart data={stats.sources_breakdown} />
        <PriorityDistribution data={stats.feature_requests_by_priority} />
      </div>

      <RecentActivityFeed activities={activities} />
    </div>
  );
}
