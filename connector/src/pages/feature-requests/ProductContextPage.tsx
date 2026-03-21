import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Database,
  GitPullRequest,
  ExternalLink,
  Loader2,
  Radio,
} from "lucide-react";

import ChatPanel from "@/components/agent/ChatPanel";
import PanelResizer from "@/components/layout/PanelResizer";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import SignalModal from "@/components/signals/SignalModal";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
import {
  useAgentJobs,
  useCodeIndexStatus,
  useFeatureRequestSummary,
  usePrFiles,
  useTriggerOrchestration,
} from "@/hooks/use-agent";
import { useConnectors } from "@/hooks/use-connectors";
import {
  useFeatureRequest,
  useFeatureRequestActions,
  useFeatureRequests,
} from "@/hooks/use-feature-requests";
import type { AgentJob, PrFile } from "@/types/agent";
import type {
  FeatureRequest,
  SupportingEvidence,
} from "@/types/feature-request";

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

function SummaryBanner({ featureRequest }: { featureRequest: FeatureRequest }) {
  const [isOpen, setIsOpen] = useState(true);
  const summaryQuery = useFeatureRequestSummary(
    featureRequest.id,
    featureRequest.synthesis_summary,
  );
  const summary =
    featureRequest.synthesis_summary || summaryQuery.data?.data?.summary;
  const isLoading = !featureRequest.synthesis_summary && summaryQuery.isLoading;

  return (
    <div className="border-b border-[var(--line-soft)]">
      <button
        className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)]"
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? (
          <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
        )}
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ink)]">
          Summary
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-5 pt-0">
          {isLoading && (
            <p className="text-[14px] leading-snug text-[var(--ink-muted)]">
              Generating summary...
            </p>
          )}
          {summary && (
            <p className="text-[14px] leading-snug text-[var(--ink)]">
              {summary}
            </p>
          )}
          {!isLoading && !summary && summaryQuery.isError && (
            <p className="text-[14px] leading-snug text-[var(--ink-muted)]">
              Could not generate summary.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AgentThread({
  jobs,
  featureRequest,
}: {
  jobs: AgentJob[];
  featureRequest: FeatureRequest;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (jobs.length === 0) {
    return (
      <div className="py-2">
        <SummaryBanner featureRequest={featureRequest} />
        <div className="flex items-center justify-center p-8">
          <p className="text-[13px] text-[var(--ink-muted)]">
            No runs yet. Click Generate PR to start.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      <SummaryBanner featureRequest={featureRequest} />
      {jobs.map((job, idx) => {
        const isOpen = !collapsed[job.id];
        const taskCount = job.result?.tasks.length ?? 0;

        return (
          <div
            key={job.id}
            className="border-b border-[var(--line-soft)] last:border-b-0"
          >
            <button
              className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)]"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [job.id]: !prev[job.id] }))
              }
            >
              {isOpen ? (
                <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
              )}
              <span
                className={`size-2 shrink-0 rounded-full ${STATUS_DOT[job.status] ?? "bg-zinc-400"}`}
              />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ink)]">
                {job.result?.feature_name ?? `Run #${jobs.length - idx}`}
              </span>
              {taskCount > 0 && (
                <span className="shrink-0 text-[12px] text-[var(--ink-muted)]">
                  {taskCount} tasks
                </span>
              )}
            </button>

            {isOpen && (
              <div className="px-6 pb-5 pt-0">
                {job.error && (
                  <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-600">
                    {job.error}
                  </p>
                )}
                {job.result && (
                  <div className="space-y-2">
                    <p className="text-[14px] leading-snug text-[var(--ink)]">
                      {job.result.spec_summary}
                    </p>

                    {job.result.tasks.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[12px] text-[var(--ink-muted)]">
                          Planned tasks
                        </p>
                        <div className="space-y-1">
                          {job.result.tasks.map((task, i) => (
                            <div
                              key={`${job.id}-t-${i}`}
                              className="flex items-start gap-2.5 text-[14px] leading-snug text-[var(--ink-soft)]"
                            >
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

/* ── PR files panel (GitHub consolidated diff vs base) ─────── */

function PrPatchPreview({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  return (
    <div className="max-h-[320px] overflow-auto bg-[var(--surface-muted)] px-2 py-2 font-mono text-[11px] leading-[17px]">
      {lines.map((line, li) => {
        let rowClass =
          "whitespace-pre-wrap break-all px-1.5 py-px text-[var(--ink-soft)]";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          rowClass =
            "whitespace-pre-wrap break-all bg-emerald-50 px-1.5 py-px text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          rowClass =
            "whitespace-pre-wrap break-all bg-rose-50 px-1.5 py-px text-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
        } else if (line.startsWith("@@")) {
          rowClass =
            "whitespace-pre-wrap break-all bg-zinc-100 px-1.5 py-px text-[var(--ink-muted)] dark:bg-zinc-800/80";
        }
        return (
          <div key={li} className={rowClass}>
            {line || "\u00a0"}
          </div>
        );
      })}
    </div>
  );
}

function AllChanges({
  files,
  isLoading,
  errorMessage,
  prUrl,
}: {
  files: PrFile[];
  isLoading: boolean;
  errorMessage: string | null;
  prUrl: string | null;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoadingSpinner label="Loading PR files…" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-[12px] text-rose-600">{errorMessage}</p>
        {prUrl && (
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-medium text-[var(--ink)] underline"
          >
            View on GitHub
          </a>
        )}
      </div>
    );
  }

  if (!prUrl) {
    return (
      <div className="flex h-40 items-center justify-center px-4 text-center">
        <p className="text-[12px] text-[var(--ink-muted)]">
          Generate a PR to see all files changed on the branch.
        </p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center px-4 text-center">
        <p className="text-[12px] text-[var(--ink-muted)]">
          No file changes on this PR yet.
        </p>
      </div>
    );
  }

  const totalAdd = files.reduce((s, f) => s + f.additions, 0);
  const totalDel = files.reduce((s, f) => s + f.deletions, 0);
  const expanded = expandedIdx !== null ? files[expandedIdx] : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-[var(--line-soft)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-md bg-[var(--ink)] text-[10px] font-semibold tabular-nums text-white">
            {files.length}
          </span>
          <span className="text-[12px] font-medium text-[var(--ink-soft)]">
            Files changed
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums">
            <span className="text-emerald-600">+{totalAdd}</span> /{" "}
            <span className="text-red-600">-{totalDel}</span>
          </span>
        </div>
        <p className="text-[11px] leading-snug text-[var(--ink-muted)]">
          Totals reflect the full PR vs base branch (all commits), including
          chat-applied updates.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {files.map((file, i) => (
          <div key={file.filename}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-subtle)] ${
                i < files.length - 1 && expandedIdx !== i
                  ? "border-b border-[var(--line-soft)]"
                  : ""
              } ${expandedIdx === i ? "bg-[var(--surface-subtle)]" : ""}`}
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            >
              {expandedIdx === i ? (
                <ChevronDown className="size-3 shrink-0 text-[var(--ink-muted)]" />
              ) : (
                <ChevronRight className="size-3 shrink-0 text-[var(--ink-muted)]" />
              )}
              <code className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-soft)]">
                {file.filename}
              </code>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-emerald-600">
                +{file.additions}
              </span>
              {file.deletions > 0 && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-red-600">
                  -{file.deletions}
                </span>
              )}
            </button>

            {expandedIdx === i && expanded && (
              <div className="border-b border-[var(--line-soft)]">
                {expanded.patch ? (
                  <PrPatchPreview patch={expanded.patch} />
                ) : (
                  <p className="px-4 py-3 text-[11px] leading-snug text-[var(--ink-muted)]">
                    Diff too large to preview here.{" "}
                    <a
                      href={prUrl ? `${prUrl}/files` : "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[var(--ink)] underline"
                    >
                      Open file list on GitHub
                    </a>
                  </p>
                )}
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

  if (!data || data.status === "not_started" || data.status === "pending")
    return null;

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

/* ── Left sidebar: feature request row ──────────────────────── */

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
    <div>
      <button
        type="button"
        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
          isActive
            ? "bg-[var(--surface-active)] text-[var(--ink)]"
            : "text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]"
        }`}
        onClick={() => (isActive ? onToggle() : onNavigate())}
      >
        <Radio
          className={`size-[15px] shrink-0 ${
            isActive ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
          }`}
        />

        <span
          className={`min-w-0 flex-1 truncate text-[13px] leading-snug ${
            isActive ? "font-semibold" : "font-medium"
          }`}
        >
          {item.title}
        </span>

        {signalCount > 0 && !isExpanded && (
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-muted)]">
            {signalCount}
          </span>
        )}

        {isExpanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-[var(--ink-muted)]" />
        )}
      </button>

      {isExpanded && evidence.length > 0 && (
        <div className="pb-1">
          {evidence.map((ev, i) => (
            <SignalRow
              key={ev.signal_id}
              evidence={ev}
              index={i}
              onSignalClick={onSignalClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Left sidebar: signal row ───────────────────────────────── */

function SignalRow({
  evidence,
  index,
  onSignalClick,
}: {
  evidence: SupportingEvidence;
  index: number;
  onSignalClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSignalClick(evidence.signal_id)}
      className="flex w-full items-center gap-2 py-1.5 pl-8 pr-4 text-left transition-colors hover:bg-[var(--surface-subtle)]"
    >
      <span className="size-1.5 shrink-0 rounded-full bg-[var(--ink-muted)] opacity-50" />
      <span className="truncate text-[12px] leading-snug text-[var(--ink-soft)]">
        Signal {index + 1}
      </span>
    </button>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function ProductContextPage() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const featureRequestQuery = useFeatureRequest(id);
  const featureRequestsQuery = useFeatureRequests({
    limit: 100,
    sort: "updated_at",
    order: "desc",
  });
  const actions = useFeatureRequestActions();
  const jobsQuery = useAgentJobs(id);
  const triggerMutation = useTriggerOrchestration(id);
  const { pushToast } = useToast();

  const jobsForPrFlag = jobsQuery.data?.data ?? [];
  const hasOpenPr = jobsForPrFlag.some((job) => job.result?.pull_request_url);
  const prFilesQuery = usePrFiles(id || undefined, hasOpenPr);

  const connectorsQuery = useConnectors();
  const githubConnector = useMemo(() => {
    const connectors = connectorsQuery.data?.data ?? [];
    return connectors.find((c) => c.type === "github" && c.enabled);
  }, [connectorsQuery.data]);

  const allFeatureRequests = featureRequestsQuery.data?.data ?? [];
  const frFromList = useMemo(
    () => allFeatureRequests.find((item) => item.id === id) ?? null,
    [allFeatureRequests, id],
  );
  const frDetail = featureRequestQuery.data?.data ?? null;
  /** Prefer API detail when loaded; fall back to list row so sidebar switches don't flash a full-page loader. */
  const fr = frDetail ?? frFromList;

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

  const waitingForFeatureRequest =
    Boolean(id) &&
    !fr &&
    (featureRequestsQuery.isPending || featureRequestQuery.isPending);

  if (waitingForFeatureRequest) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner label="Loading feature request" />
      </div>
    );
  }

  if (!id || !fr) {
    return (
      <EmptyState
        title="Feature request not found"
        description="This item may have been removed."
      />
    );
  }

  const jobs = jobsQuery.data?.data ?? [];
  const hasActiveJob = jobs.some(
    (j) => j.status === "pending" || j.status === "running",
  );
  const latestCompletedJob = jobs.find(
    (j) => j.status === "completed" && j.result,
  );
  const latestPrJob = jobs.find((job) => job.result?.pull_request_url);
  const latestPrUrl = latestPrJob?.result?.pull_request_url ?? null;
  const prState = latestPrJob?.result?.pull_request_state ?? "unknown";
  const prStateClasses: Record<string, string> = {
    open: "border-emerald-200 bg-emerald-50 text-emerald-700",
    closed: "border-rose-200 bg-rose-50 text-rose-700",
    merged: "border-purple-200 bg-purple-50 text-purple-700",
  };
  const prStateClass =
    prStateClasses[prState] ??
    "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]";

  const prPayload = prFilesQuery.data?.data;
  const prFilesList = prPayload?.files ?? [];
  const prUrlForChangesPanel = prPayload?.pull_request_url ?? latestPrUrl;

  const latestSignalMention = fr.impact_metrics?.latest_mention ?? null;
  const hasNewSignalsSinceLastRun =
    !latestCompletedJob ||
    (latestSignalMention
      ? new Date(latestSignalMention) > new Date(latestCompletedJob.created_at)
      : false);

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
          <span className="truncate text-[14px] font-medium text-[var(--ink)]">
            {fr.title}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {githubConnector && (
            <IndexingStatus connectorId={githubConnector.id} />
          )}

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

          <button
            className="flex items-center gap-1.5 rounded-md bg-[var(--ink)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
            disabled={hasActiveJob || triggerMutation.isPending}
            onClick={() => {
              if (!hasNewSignalsSinceLastRun) {
                pushToast(
                  "No new signals since the last PR run. Add or update signals to generate a new PR.",
                  "info",
                );
                return;
              }
              triggerMutation.mutate(undefined, {
                onSuccess: () =>
                  pushToast(
                    "PR generation started. This may take a minute.",
                    "success",
                  ),
                onError: () =>
                  pushToast("Failed to start PR generation.", "error"),
              });
            }}
          >
            {triggerMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {triggerMutation.isPending
              ? "Starting..."
              : hasActiveJob
                ? "Generating..."
                : "Generate PR"}
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--line-soft)]" />

          {latestPrUrl && (
            <span
              className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${prStateClass}`}
            >
              {prState.charAt(0).toUpperCase() + prState.slice(1)}
            </span>
          )}
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
                    navigate(`/feature-requests/${item.id}`);
                    setExpandedIds((prev) => new Set(prev).add(item.id));
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
              jobsQuery.isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <LoadingSpinner label="Loading runs..." />
                </div>
              ) : (
                <AgentThread jobs={jobs} featureRequest={fr} />
              )
            ) : (
              <div className="h-full">
                <ChatPanel featureRequestId={fr.id} latestPrUrl={latestPrUrl} />
              </div>
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
            <span className="text-[13px] font-medium text-[var(--ink)]">
              Changes
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {jobsQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <LoadingSpinner label="Loading..." />
              </div>
            ) : (
              <AllChanges
                files={prFilesList}
                isLoading={Boolean(latestPrUrl) && prFilesQuery.isLoading}
                errorMessage={
                  prFilesQuery.isError
                    ? ((prFilesQuery.error as Error)?.message ??
                      "Could not load PR files")
                    : null
                }
                prUrl={prUrlForChangesPanel}
              />
            )}
          </div>
        </aside>
      </div>

      {signalModalId && (
        <SignalModal signalId={signalModalId} onClose={closeSignalModal} />
      )}
    </div>
  );
}
