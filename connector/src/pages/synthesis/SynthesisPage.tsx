import { useMemo, useState } from "react";

import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SynthesisRunCard from "@/components/synthesis/SynthesisRunCard";
import SynthesisTriggerButton from "@/components/synthesis/SynthesisTriggerButton";
import { useEventStream } from "@/hooks/use-event-stream";
import { useRunSynthesis, useSynthesisRuns } from "@/hooks/use-synthesis";

const ACTIVE_STATUSES = new Set(["pending", "clustering", "synthesizing", "deduplicating", "prioritizing"]);

export default function SynthesisPage() {
  const runsQuery = useSynthesisRuns();
  const runMutation = useRunSynthesis();
  const { events } = useEventStream();
  const [confirmFull, setConfirmFull] = useState(false);

  const progressByRunId = useMemo(() => {
    const value = new Map<string, number>();
    [...events].reverse().forEach((event) => {
      const runId = String(event.data.run_id ?? "");
      if (!runId) return;

      if (event.event === "synthesis_completed" || event.event === "synthesis_failed") {
        value.set(runId, 100);
        return;
      }

      if (event.event === "synthesis_progress") {
        const progress = Number(event.data.progress ?? 0);
        value.set(runId, progress * (progress <= 1 ? 100 : 1));
      }
    });
    return value;
  }, [events]);

  if (runsQuery.isLoading) {
    return <LoadingSpinner label="Loading synthesis runs" />;
  }

  if (runsQuery.isError) {
    return <EmptyState title="Synthesis unavailable" description="Could not load synthesis runs." />;
  }

  const runs = runsQuery.data?.data ?? [];
  const active = runs.find((run) => ACTIVE_STATUSES.has(run.status));
  const pastRuns = runs.filter((run) => run.id !== active?.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Synthesis</h2>
        <p className="text-[13px] text-[var(--ink-soft)]">Run incremental or full synthesis and monitor progress in real time.</p>
      </div>

      <section className="panel flex flex-wrap items-center gap-3 p-4">
        <SynthesisTriggerButton mode="incremental" onRun={(mode) => runMutation.mutate({ mode })} disabled={runMutation.isPending} />
        <SynthesisTriggerButton mode="full" onRun={() => setConfirmFull(true)} disabled={runMutation.isPending} />
      </section>

      {active ? (
        <section className="panel p-4">
          <h3 className="mb-2 text-[15px] font-medium">Active Run</h3>
          <SynthesisRunCard run={active} activeProgress={progressByRunId.get(active.id)} />
        </section>
      ) : null}

      <section className="panel p-4">
        <h3 className="mb-2 text-[15px] font-medium">Past Runs</h3>
        {pastRuns.length === 0 ? (
          <p className="text-[13px] text-[var(--ink-soft)]">No synthesis runs yet.</p>
        ) : (
          <div className="space-y-2">
            {pastRuns.map((run) => (
              <SynthesisRunCard key={run.id} run={run} activeProgress={progressByRunId.get(run.id)} />
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmFull}
        title="Run Full Re-Synthesis"
        description="This deletes draft feature requests and reprocesses all completed signals. Continue?"
        confirmLabel="Run Full"
        onCancel={() => setConfirmFull(false)}
        onConfirm={() => {
          runMutation.mutate({ mode: "full" });
          setConfirmFull(false);
        }}
      />
    </div>
  );
}
