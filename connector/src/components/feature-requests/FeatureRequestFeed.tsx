import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Clock3,
  Flame,
  MessageSquare,
  Minus,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { getPrStatus } from "@/api/agent";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import { formatNumber, formatSourceLabel, initials, timeAgo } from "@/lib/utils";
import type {
  FeatureRequest,
  FeatureRequestStatus,
  FeatureRequestType,
} from "@/types/feature-request";

export type FeatureRequestFeedSort = "recent" | "priority" | "signal";

const TYPE_META: Record<
  FeatureRequestType,
  {
    label: string;
  }
> = {
  feature: {
    label: "Insight Agent",
  },
  bug_fix: {
    label: "Bug Response",
  },
  improvement: {
    label: "Product Signal",
  },
  integration: {
    label: "Connector Watch",
  },
  ux_change: {
    label: "Experience Review",
  },
};

const PRIORITY_FLAG_STYLES = {
  critical: {
    tileClassName: "bg-rose-100 text-rose-700",
    poleClassName: "text-rose-500/85",
    clothClassName: "text-rose-600",
  },
  high: {
    tileClassName: "bg-orange-100 text-orange-700",
    poleClassName: "text-orange-500/85",
    clothClassName: "text-orange-600",
  },
  medium: {
    tileClassName: "bg-amber-100 text-amber-700",
    poleClassName: "text-amber-500/85",
    clothClassName: "text-amber-600",
  },
  low: {
    tileClassName: "bg-emerald-100 text-emerald-700",
    poleClassName: "text-emerald-500/85",
    clothClassName: "text-emerald-600",
  },
} as const;

const STATUS_META: Record<
  FeatureRequestStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-zinc-100 text-zinc-700",
  },
  reviewed: {
    label: "In Review",
    className: "bg-sky-100 text-sky-700",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rose-100 text-rose-700",
  },
  merged: {
    label: "Merged",
    className: "bg-violet-100 text-violet-700",
  },
  sent_to_agent: {
    label: "Queued",
    className: "bg-amber-100 text-amber-700",
  },
};

export const FEED_SORT_OPTIONS: Array<{
  value: FeatureRequestFeedSort;
  label: string;
}> = [
  { value: "recent", label: "Recent" },
  { value: "priority", label: "Priority" },
  { value: "signal", label: "By Signal" },
];

const SOURCE_ICON_MAP: Record<string, string> = {
  figma: "figma",
  github: "github",
  google_forms: "google_forms",
  granola: "granola",
  intercom: "intercom",
  microsoft_teams: "teams",
  teams: "teams",
  servicenow: "servicenow",
  slack: "slack",
  zendesk: "zendesk",
};

function compareFeatureRequests(
  left: FeatureRequest,
  right: FeatureRequest,
  sort: FeatureRequestFeedSort,
): number {
  if (sort === "priority") {
    if (right.priority_score !== left.priority_score) {
      return right.priority_score - left.priority_score;
    }
  }

  if (sort === "signal") {
    const rightSignals = right.impact_metrics?.signal_count ?? 0;
    const leftSignals = left.impact_metrics?.signal_count ?? 0;
    if (rightSignals !== leftSignals) {
      return rightSignals - leftSignals;
    }
    if (right.priority_score !== left.priority_score) {
      return right.priority_score - left.priority_score;
    }
  }

  return (
    new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
}

function confidenceValue(featureRequest: FeatureRequest): number {
  const raw =
    featureRequest.synthesis_confidence ??
    Math.min(96, Math.max(42, featureRequest.priority_score * 10));
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function TrendIcon({ direction }: { direction?: string }) {
  const className = "h-3.5 w-3.5";
  if (direction === "increasing") {
    return <TrendingUp className={`${className} text-emerald-600`} />;
  }
  if (direction === "decreasing") {
    return <TrendingDown className={`${className} text-rose-600`} />;
  }
  return <Minus className={`${className} text-[var(--ink-muted)]`} />;
}

function sourceEntries(featureRequest: FeatureRequest): Array<{
  key: string;
  label: string;
  icon?: string;
}> {
  const rawSources =
    featureRequest.supporting_evidence.length > 0
      ? featureRequest.supporting_evidence.map((item) => item.source)
      : Object.keys(featureRequest.impact_metrics?.source_breakdown ?? {});

  const uniqueSources = Array.from(
    new Set(
      rawSources
        .map((source) => source.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  return uniqueSources.slice(0, 4).map((source) => ({
    key: source,
    label: formatSourceLabel(source),
    icon: SOURCE_ICON_MAP[source],
  }));
}

function PriorityFlagIcon({
  priority,
}: {
  priority: FeatureRequest["priority"];
}) {
  const style = PRIORITY_FLAG_STYLES[priority];

  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.tileClassName}`}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
      >
        <path
          d="M7 4.5v15"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className={style.poleClassName}
        />
        <path
          d="M8.2 5.2c2.3-1.2 4.5-.2 6.4-.2 1.4 0 2.3-.4 3.2-.9v7.2c-.9.5-1.8.9-3.2.9-1.9 0-4.1-1-6.4.2V5.2Z"
          fill="currentColor"
          className={style.clothClassName}
        />
      </svg>
    </div>
  );
}

function FeedCard({
  featureRequest,
  prStatus,
}: {
  featureRequest: FeatureRequest;
  prStatus?: string;
}) {
  const navigate = useNavigate();
  const meta = TYPE_META[featureRequest.type];
  const statusMeta = STATUS_META[featureRequest.status];
  const companies = Array.from(
    new Set(
      featureRequest.supporting_evidence
        .map((item) => item.customer_company?.trim())
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, 3);
  const summary =
    featureRequest.problem_statement?.trim() ||
    featureRequest.synthesis_summary?.trim() ||
    featureRequest.proposed_solution?.trim() ||
    "No summary available yet for this request.";
  const confidence = confidenceValue(featureRequest);
  const urgency = featureRequest.impact_metrics?.avg_urgency_score ?? 0;
  const sources = sourceEntries(featureRequest);

  return (
    <article
      role="link"
      tabIndex={0}
      className="group relative z-0 flex h-full cursor-pointer flex-col rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.2)] transition-all hover:z-30 hover:-translate-y-0.5 hover:border-[var(--line-muted)] hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.24)] focus-within:z-30"
      onClick={() => navigate(`/feature-requests/${featureRequest.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/feature-requests/${featureRequest.id}`);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <PriorityFlagIcon priority={featureRequest.priority} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-soft)]">
              {meta.label}
            </p>
            <div className="group/title relative mt-1">
              <h3 className="text-[18px] font-semibold leading-tight text-[var(--ink)] transition-colors group-hover:text-[var(--accent-hover)]">
                {featureRequest.title}
              </h3>
              <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 w-max max-w-[min(32rem,calc(100vw-5rem))] rounded-xl bg-[var(--ink)] px-3 py-2 text-[12px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-75 group-hover/title:opacity-100 group-focus-within/title:opacity-100">
                {featureRequest.title}
              </div>
            </div>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-5 flex flex-1 flex-col">
        <p className="line-clamp-4 text-[15px] leading-8 text-[var(--ink-soft)]">
          {summary}
        </p>

        <div className="mt-auto pt-6">
          {sources.length > 0 ? (
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                Sources
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {sources.map((source) =>
                  source.icon ? (
                    <span
                      key={source.key}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)]"
                      title={source.label}
                    >
                      <ConnectorLogo
                        icon={source.icon}
                        alt={source.label}
                        className="h-4.5 w-4.5 object-contain"
                      />
                    </span>
                  ) : (
                    <span
                      key={source.key}
                      className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]"
                      title={source.label}
                    >
                      {source.label}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : null}

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                  Confidence Score
                </span>
                <span className="text-[13px] font-semibold text-[var(--ink)]">
                  {confidence}%
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[var(--surface-subtle)]">
                <div
                  className="h-full rounded-full bg-[var(--action-primary)] transition-[width] duration-300"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>

            {companies.length > 0 ? (
              <div className="flex shrink-0 items-center">
                {companies.map((company, index) => (
                  <span
                    key={company}
                    className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--ink)] first:ml-0"
                    style={{ zIndex: companies.length - index }}
                    title={company}
                  >
                    {initials(company)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--line-soft)] pt-4 text-[13px] text-[var(--ink-soft)]">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-[var(--ink-muted)]" />
              {featureRequest.impact_metrics?.signal_count ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendIcon direction={featureRequest.impact_metrics?.trend_direction} />
              {urgency.toFixed(1)} urgency
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-[var(--ink-muted)]" />
              {timeAgo(featureRequest.updated_at)}
            </span>
            {prStatus ? (
              <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--ink)]">
                PR {prStatus}
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PriorityBadge priority={featureRequest.priority} />
              <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]">
                Score {featureRequest.priority_score}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--action-primary)]">
              View Analysis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeatureRequestFeed({
  items,
  total,
  sort,
  onSortChange,
  onOpenSheets,
}: {
  items: FeatureRequest[];
  total: number;
  sort: FeatureRequestFeedSort;
  onSortChange: (value: FeatureRequestFeedSort) => void;
  onOpenSheets: () => void;
}) {
  const prQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["pr-status", item.id],
      queryFn: () => getPrStatus(item.id),
      staleTime: 30_000,
    })),
  });

  const prStatusById = useMemo(() => {
    const result = new Map<string, string>();
    prQueries.forEach((query, index) => {
      const item = items[index];
      const payload = query.data?.data;
      if (item && payload?.exists && payload.state) {
        result.set(item.id, payload.state);
      }
    });
    return result;
  }, [items, prQueries]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => compareFeatureRequests(left, right, sort)),
    [items, sort],
  );

  const featuredItems = sortedItems.slice(0, 2);
  const gridItems = sortedItems.slice(2);

  const stats = useMemo(() => {
    const activeCount = items.filter(
      (item) => item.status !== "merged" && item.status !== "rejected",
    ).length;
    const totalSignals = items.reduce(
      (sum, item) => sum + (item.impact_metrics?.signal_count ?? 0),
      0,
    );
    const totalCompanies = items.reduce(
      (sum, item) => sum + (item.impact_metrics?.unique_companies ?? 0),
      0,
    );
    const totalCustomers = items.reduce(
      (sum, item) => sum + (item.impact_metrics?.unique_customers ?? 0),
      0,
    );
    const confidenceValues = items
      .map((item) => item.synthesis_confidence)
      .filter((value): value is number => typeof value === "number");
    const avgConfidence = confidenceValues.length
      ? Math.round(
          confidenceValues.reduce((sum, value) => sum + value, 0) /
            confidenceValues.length,
        )
      : null;
    const areas = new Map<string, number>();
    items.forEach((item) => {
      item.affected_product_areas.forEach((area) => {
        areas.set(area, (areas.get(area) ?? 0) + 1);
      });
    });
    const topAreas = Array.from(areas.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);

    return {
      activeCount,
      totalSignals,
      totalCompanies,
      totalCustomers,
      avgConfidence,
      topAreas,
    };
  }, [items]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--canvas-subtle)]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-6 sm:px-6 xl:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-6">
            {featuredItems.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {featuredItems.map((item) => (
                  <FeedCard
                    key={item.id}
                    featureRequest={item}
                    prStatus={prStatusById.get(item.id)}
                  />
                ))}
              </div>
            ) : null}

            {gridItems.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {gridItems.map((item) => (
                  <FeedCard
                    key={item.id}
                    featureRequest={item}
                    prStatus={prStatusById.get(item.id)}
                  />
                ))}
              </div>
            ) : null}
          </section>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start xl:z-10">
            <div className="w-full">
              <div className="flex w-full items-center rounded-full border border-[var(--line)] bg-[var(--surface-subtle)] p-1">
                {FEED_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`flex-1 rounded-full px-3 py-1.5 text-center text-[12px] font-medium transition-colors ${
                      sort === option.value
                        ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                        : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                    onClick={() => onSortChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <section className="overflow-hidden rounded-[32px] bg-[var(--action-primary)] p-6 text-white shadow-[0_24px_48px_-28px_rgba(0,0,0,0.45)]">
              <div className="pointer-events-none absolute" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                Request Pulse
              </p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em]">
                Live triage snapshot
              </h2>
              <p className="mt-2 text-[15px] leading-7 text-white/72">
                A compact summary of the same request dataset shown in the
                feed, tuned for quick review.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="inline-flex items-center gap-2 text-white/72">
                    <BarChart3 className="h-4 w-4" />
                    Requests tracked
                  </span>
                  <span className="text-[30px] font-semibold">
                    {formatNumber(total)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="inline-flex items-center gap-2 text-white/72">
                    <MessageSquare className="h-4 w-4" />
                    Signals linked
                  </span>
                  <span className="text-[30px] font-semibold">
                    {formatNumber(stats.totalSignals)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="inline-flex items-center gap-2 text-white/72">
                    <Users className="h-4 w-4" />
                    Customer mentions
                  </span>
                  <span className="text-[30px] font-semibold">
                    {formatNumber(stats.totalCustomers)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-white/72">
                    <Building2 className="h-4 w-4" />
                    Companies mapped
                  </span>
                  <span className="text-[30px] font-semibold">
                    {formatNumber(stats.totalCompanies)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-[14px] font-semibold text-[var(--action-primary)] transition-colors hover:bg-white/90"
                onClick={onOpenSheets}
              >
                Open Sheets View
              </button>
            </section>

            <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-soft)]">
                    Triage Focus
                  </p>
                  <h3 className="mt-2 text-[20px] font-semibold text-[var(--ink)]">
                    Leading product areas
                  </h3>
                </div>
                {stats.avgConfidence != null ? (
                  <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink)]">
                    Avg confidence {stats.avgConfidence}%
                  </span>
                ) : null}
              </div>

              <div className="mt-6 space-y-3">
                {stats.topAreas.length > 0 ? (
                  stats.topAreas.map(([area, count]) => (
                    <div
                      key={area}
                      className="flex items-center justify-between rounded-2xl bg-[var(--surface-subtle)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[var(--ink)]">
                          {area}
                        </p>
                        <p className="text-[12px] text-[var(--ink-muted)]">
                          Featured in current request set
                        </p>
                      </div>
                      <span className="shrink-0 text-[20px] font-semibold text-[var(--ink)]">
                        {count}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-[var(--surface-subtle)] px-4 py-5 text-[14px] text-[var(--ink-soft)]">
                    No product-area tags are available yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.18)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ink-soft)]">
                Browse Mode
              </p>
              <h3 className="mt-2 text-[20px] font-semibold text-[var(--ink)]">
                Designed for fast scanning
              </h3>
              <div className="mt-5 space-y-3 text-[14px] text-[var(--ink-soft)]">
                <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-subtle)] px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[var(--ink-muted)]" />
                    Signal-heavy requests
                  </span>
                  <span className="font-semibold text-[var(--ink)]">
                    {formatNumber(
                      items.filter(
                        (item) => (item.impact_metrics?.signal_count ?? 0) >= 5,
                      ).length,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[var(--surface-subtle)] px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <Flame className="h-4 w-4 text-[var(--ink-muted)]" />
                    High urgency
                  </span>
                  <span className="font-semibold text-[var(--ink)]">
                    {formatNumber(
                      items.filter(
                        (item) =>
                          (item.impact_metrics?.avg_urgency_score ?? 0) >= 7,
                      ).length,
                    )}
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
