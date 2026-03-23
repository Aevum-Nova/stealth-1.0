import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, RotateCw } from "lucide-react";

import { getDashboardStats } from "@/api/dashboard";
import SourceBreakdownChart from "@/components/dashboard/SourceBreakdownChart";
import PriorityDistribution from "@/components/dashboard/PriorityDistribution";
import RecentActivityFeed from "@/components/dashboard/RecentActivityFeed";
import StatsGrid from "@/components/dashboard/StatsGrid";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEventStream } from "@/hooks/use-event-stream";
import { useJobs } from "@/hooks/use-jobs";
import { useSignals } from "@/hooks/use-signals";
import { useRunSynthesis } from "@/hooks/use-synthesis";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { events } = useEventStream();

  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 60_000
  });

  const jobsQuery = useJobs();
  const signalsQuery = useSignals({ limit: 20, sort: "created_at", order: "desc" });

  const runMutation = useRunSynthesis({
    onSuccess: () => navigate("/synthesis")
  });

  const activities = useMemo(() => {
    const items: Array<{ id: string; label: string; kind: string; status?: string; timestamp: string }> = [];

    // Add persisted jobs
    const jobs = jobsQuery.data?.data ?? [];
    for (const job of jobs.slice(0, 15)) {
      let label: string;
      if (job.type === "ingestion") {
        const count = job.signal_count ?? job.processed_items ?? 0;
        label = count > 0
          ? `Ingested ${count} signal${count !== 1 ? "s" : ""}`
          : "Ingestion ran — no new signals";
        if (job.failed_items) label += ` (${job.failed_items} failed)`;
      } else {
        const parts: string[] = [];
        if (job.cluster_count) parts.push(`${job.cluster_count} clusters`);
        if (job.feature_request_count) parts.push(`${job.feature_request_count} feature requests`);
        label = parts.length > 0
          ? `Synthesis produced ${parts.join(", ")}`
          : "Synthesis completed";
      }
      items.push({
        id: `job-${job.id}`,
        label,
        kind: job.type,
        status: job.status,
        timestamp: job.completed_at ?? job.started_at ?? job.created_at,
      });
    }

    // Add recent signals (deduplicated from jobs)
    const signals = signalsQuery.data?.data ?? [];
    for (const sig of signals.slice(0, 10)) {
      const source = sig.source?.replaceAll("_", " ") ?? "unknown";
      const text = sig.extracted_text ?? sig.original_text ?? "";
      const preview = text.length > 80 ? text.slice(0, 80) + "..." : text;
      items.push({
        id: `signal-${sig.id}`,
        label: preview ? `Signal from ${source} — "${preview}"` : `Signal from ${source}`,
        kind: "signal",
        timestamp: sig.created_at,
      });
    }

    // Add live SSE events
    for (const event of events.slice(0, 5)) {
      items.push({
        id: `sse-${event.event}-${event.timestamp}`,
        label: event.event.replaceAll("_", " "),
        kind: event.event.includes("synthesis") ? "synthesis" : "signal",
        timestamp: new Date(event.timestamp).toISOString(),
      });
    }

    // Sort by timestamp descending, take top 12
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 12);
  }, [jobsQuery.data, signalsQuery.data, events]);

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
          {runMutation.isPending ? (
            <RotateCw className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
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
