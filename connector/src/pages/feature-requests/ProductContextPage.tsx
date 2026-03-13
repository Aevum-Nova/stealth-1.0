import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Database, GitPullRequest, ExternalLink } from "lucide-react";

import ChatPanel from "@/components/agent/ChatPanel";
import PanelResizer from "@/components/layout/PanelResizer";
import { highlightLine } from "@/lib/syntax-highlight";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import SignalModal from "@/components/signals/SignalModal";
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

const LEFT_COLLAPSED_THRESHOLD = 96;
const LEFT_DEFAULT_WIDTH = 260;

const STORAGE_LEFT = "product-context-left-panel-width";
const STORAGE_RIGHT = "product-context-right-panel-width";

function loadStoredWidth(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

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
    <div className="py-2">
      {jobs.map((job, idx) => {
        const isOpen = !collapsed[job.id];
        const taskCount = job.result?.tasks.length ?? 0;

        return (
          <div key={job.id} className="border-b border-[var(--line-soft)] last:border-b-0">
            <button
              className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)]"
              onClick={() => setCollapsed((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
            >
              {isOpen
                ? <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
                : <ChevronRight className="size-3.5 shrink-0 text-[var(--ink-muted)]" />}
              <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[job.status] ?? "bg-zinc-400"}`} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ink)]">
                {job.result?.feature_name ?? `Run #${jobs.length - idx}`}
              </span>
              {taskCount > 0 && (
                <span className="shrink-0 text-[12px] text-[var(--ink-muted)]">{taskCount} tasks</span>
              )}
            </button>

            {isOpen && (
              <div className="px-6 pb-5 pt-0">
                {job.error && (
                  <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-600">{job.error}</p>
                )}
                {job.result && (
                  <div className="space-y-2">
                    <p className="text-[14px] leading-snug text-[var(--ink)]">{job.result.spec_summary}</p>

                    {job.result.tasks.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[12px] text-[var(--ink-muted)]">
                          Planned tasks
                        </p>
                        <div className="space-y-1">
                          {job.result.tasks.map((task, i) => (
                            <div key={`${job.id}-t-${i}`} className="flex items-start gap-2.5 text-[14px] leading-snug text-[var(--ink-soft)]">
                              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[var(--ink-muted)] opacity-60" />
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
      <div className="flex flex-col gap-2.5 border-b border-[var(--line-soft)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-[var(--ink)] text-[10px] font-semibold tabular-nums text-white">
            {files.length}
          </span>
          <span className="text-[12px] font-medium text-[var(--ink-soft)]">Files changed</span>
          <span className="ml-auto font-mono text-[11px] tabular-nums">
            <span className="text-emerald-600">+{totalAdd}</span>
            {" "}/{" "}
            <span className="text-red-600">-{totalDel}</span>
          </span>
        </div>
        {hasChatChanges && canApplyToPr && (
          <div className="space-y-1">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-3 py-2 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              disabled={isApplying}
              onClick={onApplyToPr}
            >
              <GitPullRequest className="size-3.5" />
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
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-subtle)] ${
                i < files.length - 1 && expandedIdx !== i ? "border-b border-[var(--line-soft)]" : ""
              } ${expandedIdx === i ? "bg-[var(--surface-subtle)]" : ""}`}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              {expandedIdx === i
                ? <ChevronDown className="size-3 shrink-0 text-[var(--ink-muted)]" />
                : <ChevronRight className="size-3 shrink-0 text-[var(--ink-muted)]" />}
              <code className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-soft)]">{file.file_path}</code>
              {file.source === "chat" && (
                <span className="shrink-0 rounded-sm bg-[#e5e5e5] px-1.5 py-0.5 text-[9px] font-medium text-[var(--ink-muted)]">chat</span>
              )}
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-emerald-600">+{file.additions ?? 0}</span>
              {(file.deletions ?? 0) > 0 && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-red-600">-{file.deletions}</span>
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
      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
        <Database className="size-3" />
        Indexed
      </span>
    );
  }

  if (data.status === "indexing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700">
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
  onSignalClick,
}: {
  item: FeatureRequest;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  onSignalClick: (id: string) => void;
}) {
  const evidence = item.supporting_evidence ?? [];
  const signalCount = item.impact_metrics?.signal_count ?? 0;

  return (
    <div className={isActive ? "bg-[var(--surface-subtle)]" : ""}>
      <button
        className={`group relative flex w-full items-center gap-1.5 border-b border-[var(--line-soft)] py-3 pl-4 pr-3 text-left transition-colors ${
          isActive ? "" : "hover:bg-[var(--surface-subtle)]"
        }`}
        onClick={() => (isActive ? onToggle() : onNavigate())}
      >
        {isActive && <div className="absolute inset-y-0 left-0 w-[2px] bg-[var(--ink)]" />}

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
              <SignalRow key={ev.signal_id} evidence={ev} index={i} isLast={i === evidence.length - 1} onSignalClick={onSignalClick} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Left sidebar: signal row ───────────────────────────────── */

function SignalRow({ evidence, index, isLast, onSignalClick }: { evidence: SupportingEvidence; index: number; isLast: boolean; onSignalClick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSignalClick(evidence.signal_id)}
      className="group relative flex w-full items-start gap-2 py-[7px] pl-[22px] pr-3 text-left transition-colors hover:bg-[var(--surface-active)]"
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
    </button>
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
  const [signalModalId, setSignalModalId] = useState<string | null>(null);
  const closeSignalModal = useCallback(() => setSignalModalId(null), []);

  const [leftPanelWidth, setLeftPanelWidth] = useState(() =>
    loadStoredWidth(STORAGE_LEFT, 260),
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    loadStoredWidth(STORAGE_RIGHT, 280),
  );

  const handleLeftResize = useCallback((deltaX: number) => {
    setLeftPanelWidth((w) => {
      const next = Math.max(60, Math.round(w + deltaX));
      localStorage.setItem(STORAGE_LEFT, String(next));
      return next;
    });
  }, []);

  const expandLeftPanel = useCallback(() => {
    const w = LEFT_DEFAULT_WIDTH;
    setLeftPanelWidth(w);
    localStorage.setItem(STORAGE_LEFT, String(w));
  }, []);

  const handleRightResize = useCallback((deltaX: number) => {
    setRightPanelWidth((w) => {
      const next = Math.max(60, Math.round(w + deltaX));
      localStorage.setItem(STORAGE_RIGHT, String(next));
      return next;
    });
  }, []);

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
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)]">
      {/* ── Toolbar ── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line-soft)] bg-[var(--surface)] px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            to="/feature-requests"
            className="shrink-0 text-[13px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            Feature Requests
          </Link>
          <span className="shrink-0 text-[var(--ink-muted)]">/</span>
          <span className="truncate text-[14px] font-medium text-[var(--ink)]">{fr.title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {githubConnector && <IndexingStatus connectorId={githubConnector.id} />}

          <span className="rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--ink-muted)]">
            {fr.status}
          </span>
          <PriorityBadge priority={fr.priority} />

          {latestPrUrl && (
            <a
              href={latestPrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <GitPullRequest className="size-3.5" />
              Open PR
              <ExternalLink className="size-3" />
            </a>
          )}

          <div className="mx-1 h-4 w-px bg-[var(--line-soft)]" />

          <div className="flex items-center gap-1.5">
            <button
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)] disabled:opacity-40"
              disabled={hasActiveJob || triggerMutation.isPending}
              onClick={() => triggerMutation.mutate(true)}
            >
              Dry Run
            </button>
            <button
              className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
              disabled={hasActiveJob || triggerMutation.isPending}
              onClick={() => triggerMutation.mutate(false)}
            >
              Generate PR
            </button>
          </div>

          <div className="mx-1 h-4 w-px bg-[var(--line-soft)]" />

          <div className="flex items-center gap-1.5">
            <button
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-40"
              disabled={actions.approve.isPending}
              onClick={() => actions.approve.mutate(fr.id)}
            >
              Approve
            </button>
            <button
              className="rounded-md px-3 py-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-40"
              disabled={actions.reject.isPending}
              onClick={() => actions.reject.mutate(fr.id)}
            >
              Reject
            </button>
          </div>
        </div>
      </header>

      {/* ── Three columns ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Left */}
        <aside
          className="relative hidden shrink-0 flex-col overflow-hidden border-r border-[var(--line-soft)] bg-[var(--surface)] xl:flex"
          style={{ width: leftPanelWidth }}
        >
          {leftPanelWidth <= LEFT_COLLAPSED_THRESHOLD ? (
            <button
              type="button"
              onClick={expandLeftPanel}
              className="flex flex-1 items-center justify-center bg-transparent transition-colors hover:bg-[var(--surface-subtle)]"
              title="Expand Feature Requests"
              aria-label="Expand Feature Requests panel"
            >
              <ChevronRight className="size-4 shrink-0 text-[var(--ink-muted)]" />
            </button>
          ) : (
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
                  onSignalClick={setSignalModalId}
                />
              ))}
            </div>
          )}
          <PanelResizer side="left" onResize={handleLeftResize} />
        </aside>

        {/* Center */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
          <div className="flex shrink-0 gap-0.5 border-b border-[var(--line-soft)] px-5">
            <button
              className={`-mb-px border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                tab === "thread"
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-soft)]"
              }`}
              onClick={() => setTab("thread")}
            >
              Agent Thread
            </button>
            <button
              className={`-mb-px border-b-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                tab === "chat"
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-transparent text-[var(--ink-muted)] hover:text-[var(--ink-soft)]"
              }`}
              onClick={() => setTab("chat")}
            >
              Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white">
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
        <aside
          className="relative hidden shrink-0 flex-col overflow-hidden border-l border-[var(--line-soft)] bg-[var(--surface)] xl:flex"
          style={{ width: rightPanelWidth }}
        >
          <PanelResizer side="right" onResize={handleRightResize} />
          <div className="flex shrink-0 items-center border-b border-[var(--line-soft)] px-4 py-3">
            <span className="text-[13px] font-medium text-[var(--ink)]">Changes</span>
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

      {signalModalId && <SignalModal signalId={signalModalId} onClose={closeSignalModal} />}
    </div>
  );
}
