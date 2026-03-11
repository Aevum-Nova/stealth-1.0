import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Database, GitPullRequest, ExternalLink } from "lucide-react";

import ChatPanel from "@/components/agent/ChatPanel";
import { highlightLine } from "@/lib/syntax-highlight";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import {
  useAgentJobs,
  useApplyChangesToPr,
  useChatHistory,
  useCodeIndexStatus,
  useTriggerOrchestration,
} from "@/hooks/use-agent";
import { useConnectors } from "@/hooks/use-connectors";
import { useFeatureRequest, useFeatureRequestActions, useFeatureRequests } from "@/hooks/use-feature-requests";
import type { AgentJob, ProposedChange } from "@/types/agent";
import type { FeatureRequest, SupportingEvidence } from "@/types/feature-request";

type CenterTab = "thread" | "chat";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  running: "bg-sky-400 animate-pulse",
  completed: "bg-emerald-400",
  failed: "bg-rose-400",
};

/* ── Agent Thread ───────────────────────────────────────────── */

function AgentThread({ jobs }: { jobs: AgentJob[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (jobs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-[13px] text-[var(--ink-muted)]">No runs yet. Click Generate PR or Dry Run to start.</p>
      </div>
    );
  }

  return (
    <div>
      {jobs.map((job, idx) => {
        const isOpen = !collapsed[job.id];
        const taskCount = job.result?.tasks.length ?? 0;

        return (
          <div key={job.id} className="border-b border-[var(--line-soft)]">
            <button
              className="flex w-full items-center gap-2.5 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
              onClick={() => setCollapsed((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
            >
              {isOpen
                ? <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
                : <ChevronRight className="size-3.5 shrink-0 text-[var(--ink-muted)]" />}
              <span className={`size-[7px] shrink-0 rounded-full ${STATUS_DOT[job.status] ?? "bg-zinc-400"}`} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--ink)]">
                {job.result?.feature_name ?? `Run #${jobs.length - idx}`}
              </span>
              {taskCount > 0 && (
                <span className="shrink-0 text-[11px] text-[var(--ink-muted)]">{taskCount} tasks</span>
              )}
            </button>

            {isOpen && (
              <div className="px-5 pb-4 pt-0">
                {job.error && (
                  <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-600">{job.error}</p>
                )}
                {job.result && (
                  <div className="space-y-3">
                    <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">{job.result.spec_summary}</p>

                    {job.result.tasks.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
                          Planned Tasks
                        </p>
                        <div className="space-y-[6px]">
                          {job.result.tasks.map((task, i) => (
                            <div key={`${job.id}-t-${i}`} className="flex items-start gap-2.5 text-[13px] leading-snug text-[var(--ink-soft)]">
                              <span className="mt-[7px] size-[4px] shrink-0 rounded-full bg-[var(--line-muted)]" />
                              {task}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <time className="mt-3 block text-[11px] text-[var(--ink-muted)]">
                  {new Date(job.created_at).toLocaleString()}
                </time>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Unified Changes panel ─────────────────────────────────── */

interface UnifiedFile {
  file_path: string;
  reason: string;
  additions?: number;
  deletions?: number;
  content?: string;
  source: "pr" | "chat";
}

function AllChanges({
  jobs,
  chatChanges,
  onApplyToPr,
  canApplyToPr,
  isApplying,
  applyError,
}: {
  jobs: AgentJob[];
  chatChanges: ProposedChange[];
  onApplyToPr?: () => void;
  canApplyToPr?: boolean;
  isApplying?: boolean;
  applyError?: string | null;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const files = useMemo(() => {
    const map = new Map<string, UnifiedFile>();

    const latestWithChanges = jobs.find((j) => (j.result?.proposed_files.length ?? 0) > 0);
    if (latestWithChanges?.result) {
      for (const f of latestWithChanges.result.proposed_files) {
        const lineCount = f.content ? f.content.split("\n").length : 0;
        map.set(f.file_path, {
          file_path: f.file_path,
          reason: f.reason,
          content: f.content,
          additions: f.additions ?? lineCount,
          deletions: f.deletions,
          source: "pr",
        });
      }
    }

    for (const c of chatChanges) {
      map.set(c.file_path, {
        file_path: c.file_path,
        reason: c.reason,
        content: c.content,
        additions: c.content.split("\n").length,
        deletions: 0,
        source: "chat",
      });
    }

    return Array.from(map.values());
  }, [jobs, chatChanges]);

  if (files.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-[12px] text-[var(--ink-muted)]">No proposed changes yet.</p>
      </div>
    );
  }

  const totalAdd = files.reduce((s, f) => s + (f.additions ?? 0), 0);
  const totalDel = files.reduce((s, f) => s + (f.deletions ?? 0), 0);
  const expanded = expandedIdx !== null ? files[expandedIdx] : null;

  const hasChatChanges = files.some((f) => f.source === "chat");

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-[var(--line-soft)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex size-[18px] items-center justify-center rounded bg-[var(--action-primary)] text-[9px] font-semibold tabular-nums text-white">
            {files.length}
          </span>
          <span className="text-[12px] text-[var(--ink-soft)]">Files changed</span>
          <span className="ml-auto font-mono text-[11px] tabular-nums">
          <span className="text-emerald-600">+{totalAdd}</span>
          <span className="mx-1 text-[var(--line-muted)]">/</span>
            <span className="text-rose-500">-{totalDel}</span>
          </span>
        </div>
        {hasChatChanges && canApplyToPr && (
          <div className="space-y-1">
            <button
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-[6px] text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
              disabled={isApplying}
              onClick={onApplyToPr}
            >
              <GitPullRequest className="size-3" />
              {isApplying ? "Applying..." : "Apply to PR"}
            </button>
            {applyError && (
              <p className="text-[10px] text-rose-600">{applyError}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {files.map((file, i) => (
          <div key={`${file.source}-${file.file_path}`}>
            <button
              className={`flex w-full items-center gap-2 px-3 py-[6px] text-left transition-colors hover:bg-[var(--surface-hover)] ${
                i < files.length - 1 && expandedIdx !== i ? "border-b border-[var(--line-soft)]" : ""
              } ${expandedIdx === i ? "bg-[var(--surface-active)]" : ""}`}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              {expandedIdx === i
                ? <ChevronDown className="size-3 shrink-0 text-[var(--ink-muted)]" />
                : <ChevronRight className="size-3 shrink-0 text-[var(--ink-muted)]" />}
              <code className="min-w-0 flex-1 truncate text-[11px] text-[var(--ink-soft)]">{file.file_path}</code>
              {file.source === "chat" && (
                <span className="shrink-0 rounded-sm bg-violet-100 px-1 text-[8px] font-medium text-violet-700">chat</span>
              )}
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-emerald-600">+{file.additions ?? 0}</span>
              {(file.deletions ?? 0) > 0 && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-rose-500">-{file.deletions}</span>
              )}
            </button>

            {expandedIdx === i && expanded && (
              <div className="border-b border-[var(--line-soft)]">
                {expanded.reason && (
                  <p className="px-3 py-1.5 text-[10px] text-[var(--ink-muted)]">{expanded.reason}</p>
                )}
                {expanded.content ? (
                  <div className="max-h-[300px] overflow-auto bg-[var(--surface-muted)]">
                    {expanded.content.split("\n").map((line, li) => (
                      <div key={li} className="flex text-[11px] leading-[18px]">
                        <span className="w-8 shrink-0 select-none pr-2 text-right font-mono text-[var(--ink-muted)] opacity-40">{li + 1}</span>
                        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all px-1 font-mono">
                          <code dangerouslySetInnerHTML={{ __html: highlightLine(line) }} />
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : !expanded.reason ? (
                  <p className="px-3 py-2 text-[10px] italic text-[var(--ink-muted)]">No preview available</p>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Indexing status indicator (passive) ───────────────────── */

function IndexingStatus({ connectorId }: { connectorId: string }) {
  const statusQuery = useCodeIndexStatus(connectorId);
  const data = statusQuery.data?.data;

  if (!data || data.status === "not_started" || data.status === "pending") return null;

  if (data.status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-[3px] text-[10px] font-medium text-emerald-700">
        <Database className="size-2.5" />
        Indexed
      </span>
    );
  }

  if (data.status === "indexing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-[3px] text-[10px] font-medium text-sky-700">
        <Database className="size-2.5 animate-pulse" />
        Indexing {data.indexed_files}/{data.total_files}
      </span>
    );
  }

  return null;
}

/* ── Left sidebar: feature request group ────────────────────── */

function FeatureRequestGroup({
  item,
  isActive,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  item: FeatureRequest;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const evidence = item.supporting_evidence ?? [];
  const signalCount = item.impact_metrics?.signal_count ?? 0;

  return (
    <div className={isActive ? "bg-[var(--surface)]" : ""}>
      <button
        className={`group relative flex w-full items-center gap-1 border-b border-[var(--line-soft)] py-[9px] pl-3 pr-2.5 text-left transition-colors ${
          isActive ? "" : "hover:bg-[var(--surface-hover)]"
        }`}
        onClick={() => (isActive ? onToggle() : onNavigate())}
      >
        {isActive && <div className="absolute inset-y-0 left-0 w-[2px] bg-[var(--action-primary)]" />}

        <span className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${isActive ? "font-semibold text-[var(--ink)]" : "font-medium text-[var(--ink-soft)]"}`}>
          {item.title}
        </span>

        {signalCount > 0 && !isExpanded && (
          <span className="mr-1.5 shrink-0 text-[10px] tabular-nums text-[var(--ink-muted)]">{signalCount}</span>
        )}

        {isExpanded
          ? <ChevronDown className="size-[14px] shrink-0 text-[var(--ink-muted)]" />
          : <ChevronRight className="size-[14px] shrink-0 text-[var(--ink-muted)]" />}
      </button>

      {isExpanded && (
        <div className="border-b border-[var(--line-soft)]">
          {evidence.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-[var(--ink-muted)]">No signals linked yet.</p>
          ) : (
            evidence.map((ev, i) => (
              <SignalRow key={ev.signal_id} evidence={ev} index={i} isLast={i === evidence.length - 1} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Left sidebar: signal row ───────────────────────────────── */

function SignalRow({ evidence, index, isLast }: { evidence: SupportingEvidence; index: number; isLast: boolean }) {
  return (
    <Link
      to={`/signals/${evidence.signal_id}`}
      className="group relative flex items-start gap-2 py-[7px] pl-[22px] pr-3 transition-colors hover:bg-[var(--surface-active)]"
    >
      <div className={`absolute left-[11px] top-0 w-px bg-[var(--line-tree)] ${isLast ? "h-[14px]" : "h-full"}`} />
      <div className="absolute left-[9px] top-[12px] size-[5px] rounded-full border border-[var(--line-muted)] bg-[var(--surface-contrast)] group-hover:border-[var(--ink-muted)]" />

      <div className="min-w-0 flex-1 pl-0.5">
        <p className="truncate text-[12px] leading-snug text-[var(--ink-soft)] group-hover:text-[var(--ink)]">
          {evidence.signal_summary || evidence.representative_quote}
        </p>
        <p className="mt-[2px] truncate text-[10px] leading-tight text-[var(--ink-muted)]">
          {evidence.source}
          {evidence.customer_company ? ` · ${evidence.customer_company}` : ""}
          {evidence.author_name ? ` · ${evidence.author_name}` : ""}
        </p>
      </div>
    </Link>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function ProductContextPage() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const featureRequestQuery = useFeatureRequest(id);
  const featureRequestsQuery = useFeatureRequests({ limit: 100, sort: "updated_at", order: "desc" });
  const actions = useFeatureRequestActions();
  const jobsQuery = useAgentJobs(id);
  const triggerMutation = useTriggerOrchestration(id);
  const applyMutation = useApplyChangesToPr(id);
  const chatQuery = useChatHistory(id);

  const connectorsQuery = useConnectors();
  const githubConnector = useMemo(() => {
    const connectors = connectorsQuery.data?.data ?? [];
    return connectors.find((c) => c.type === "github" && c.enabled);
  }, [connectorsQuery.data]);

  const fr = featureRequestQuery.data?.data ?? null;
  const [tab, setTab] = useState<CenterTab>("thread");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fr?.id) setExpandedIds(new Set([fr.id]));
  }, [fr?.id]);

  // Extract the latest proposed changes from chat messages
  const chatProposedChanges: ProposedChange[] = useMemo(() => {
    const messages = chatQuery.data?.data?.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].proposed_changes && messages[i].proposed_changes!.length > 0) {
        return messages[i].proposed_changes!;
      }
    }
    return [];
  }, [chatQuery.data]);

  if (featureRequestQuery.isLoading) {
    return <div className="flex h-full items-center justify-center"><LoadingSpinner label="Loading feature request" /></div>;
  }
  if (featureRequestQuery.isError || !fr) {
    return <EmptyState title="Feature request not found" description="This item may have been removed." />;
  }

  const allFeatureRequests = featureRequestsQuery.data?.data ?? [];
  const jobs = jobsQuery.data?.data ?? [];
  const hasActiveJob = jobs.some((j) => j.status === "pending" || j.status === "running");
  const latestPrUrl = jobs.find((job) => job.result?.pull_request_url)?.result?.pull_request_url ?? null;

  const toggleExpand = (itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--surface)]">
      {/* ── Toolbar ── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line-strong)] px-4 py-[7px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link to="/feature-requests" className="shrink-0 text-[12px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]">
            ← Feature Requests
          </Link>
          <span className="shrink-0 text-[var(--line-strong)]">/</span>
          <span className="truncate text-[13px] font-medium text-[var(--ink)]">{fr.title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {githubConnector && <IndexingStatus connectorId={githubConnector.id} />}

          <span className="rounded-full border border-[var(--line-strong)] px-2 py-[3px] text-[10px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
            {fr.status}
          </span>
          <PriorityBadge priority={fr.priority} />

          {latestPrUrl && (
            <>
              <div className="mx-0.5 h-4 w-px bg-[var(--line)]" />
              <a
                href={latestPrUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-[3px] text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <GitPullRequest className="size-3" />PR<ExternalLink className="size-2.5" />
              </a>
            </>
          )}

          <div className="mx-0.5 h-4 w-px bg-[var(--line)]" />

          <button
            className="rounded-md border border-[var(--line-strong)] px-2.5 py-[4px] text-[11px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-subtle)] disabled:opacity-40"
            disabled={hasActiveJob || triggerMutation.isPending}
            onClick={() => triggerMutation.mutate(true)}
          >Dry Run</button>
          <button
            className="rounded-md bg-[var(--action-primary)] px-2.5 py-[4px] text-[11px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:opacity-40"
            disabled={hasActiveJob || triggerMutation.isPending}
            onClick={() => triggerMutation.mutate(false)}
          >Generate PR</button>

          <div className="mx-0.5 h-4 w-px bg-[var(--line)]" />

          <button
            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-[4px] text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-40"
            disabled={actions.approve.isPending}
            onClick={() => actions.approve.mutate(fr.id)}
          >Approve</button>
          <button
            className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-[4px] text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-40"
            disabled={actions.reject.isPending}
            onClick={() => actions.reject.mutate(fr.id)}
          >Reject</button>
        </div>
      </header>

      {/* ── Three columns ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left */}
        <aside className="hidden w-[264px] shrink-0 flex-col overflow-hidden border-r border-[var(--line-strong)] bg-[var(--surface-contrast)] xl:flex">
          <div className="flex-1 overflow-y-auto">
            {allFeatureRequests.map((item) => (
              <FeatureRequestGroup
                key={item.id}
                item={item}
                isActive={item.id === fr.id}
                isExpanded={expandedIds.has(item.id)}
                onToggle={() => toggleExpand(item.id)}
                onNavigate={() => {
                  navigate(`/feature-requests/${item.id}/context`);
                  setExpandedIds(new Set([item.id]));
                }}
              />
            ))}
          </div>
        </aside>

        {/* Center */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center border-b border-[var(--line-strong)] px-1">
            <button
              className={`border-b-2 px-3.5 py-[9px] text-[12px] font-medium transition-colors ${
                tab === "thread"
                  ? "border-[var(--action-primary)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-soft)]"
              }`}
              onClick={() => setTab("thread")}
            >Agent Thread</button>
            <button
              className={`border-b-2 px-3.5 py-[9px] text-[12px] font-medium transition-colors ${
                tab === "chat"
                  ? "border-[var(--action-primary)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-soft)]"
              }`}
              onClick={() => setTab("chat")}
            >Chat</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "thread" ? (
              jobsQuery.isLoading
                ? <div className="flex h-40 items-center justify-center"><LoadingSpinner label="Loading runs..." /></div>
                : <AgentThread jobs={jobs} />
            ) : (
              <div className="h-full"><ChatPanel featureRequestId={fr.id} /></div>
            )}
          </div>
        </main>

        {/* Right */}
        <aside className="hidden w-[280px] shrink-0 flex-col overflow-hidden border-l border-[var(--line-strong)] bg-[var(--surface-contrast)] xl:flex">
          <div className="flex shrink-0 items-center border-b border-[var(--line-strong)] px-3 py-[9px]">
            <span className="text-[12px] font-medium text-[var(--ink)]">Changes</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {jobsQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center"><LoadingSpinner label="Loading..." /></div>
            ) : (
              <AllChanges
                jobs={jobs}
                chatChanges={chatProposedChanges}
                canApplyToPr={chatProposedChanges.length > 0 && !!latestPrUrl}
                isApplying={applyMutation.isPending}
                applyError={
                  applyMutation.isError
                    ? (applyMutation.error as Error)?.message ?? "Failed to apply changes"
                    : null
                }
                onApplyToPr={() => applyMutation.mutate(chatProposedChanges)}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
