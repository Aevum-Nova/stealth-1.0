import { useNavigate } from "react-router-dom";
import {
  X,
  MessageSquare,
  Users,
  Building2,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from "lucide-react";

import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import { timeAgo } from "@/lib/utils";
import type {
  FeatureRequest,
  FeatureRequestPriority,
  FeatureRequestType,
} from "@/types/feature-request";

const PRIORITY_ACCENT: Record<FeatureRequestPriority, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-400",
  low: "border-l-emerald-500",
};

const TYPE_LABELS: Record<FeatureRequestType, string> = {
  feature: "Feature",
  bug_fix: "Bug Fix",
  improvement: "Improvement",
  integration: "Integration",
  ux_change: "UX Change",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-zinc-400",
  reviewed: "bg-blue-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  merged: "bg-violet-500",
  sent_to_agent: "bg-amber-500",
};

function TrendIcon({ direction }: { direction?: string }) {
  const cls = "h-3 w-3";
  if (direction === "increasing") return <TrendingUp className={`${cls} text-emerald-500`} />;
  if (direction === "decreasing") return <TrendingDown className={`${cls} text-red-500`} />;
  return <Minus className={`${cls} text-[var(--ink-muted)]`} />;
}

function urgencyColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 5) return "text-amber-500";
  return "text-emerald-500";
}

interface FeatureRequestCardProps {
  featureRequest: FeatureRequest;
  onDelete: (id: string) => void;
}

export default function FeatureRequestCard({ featureRequest, onDelete }: FeatureRequestCardProps) {
  const navigate = useNavigate();
  const metrics = featureRequest.impact_metrics;

  return (
    <article
      role="link"
      tabIndex={0}
      className={`group flex cursor-pointer flex-col gap-3 rounded-xl border border-[var(--line)] border-l-2 bg-[var(--surface)] p-4 transition-all hover:border-[var(--line-muted)] hover:shadow-[0_2px_8px_var(--shadow-soft)] ${PRIORITY_ACCENT[featureRequest.priority]}`}
      onClick={() => navigate(`/feature-requests/${featureRequest.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/feature-requests/${featureRequest.id}`);
        }
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={featureRequest.priority} />
          <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
            {TYPE_LABELS[featureRequest.type] ?? featureRequest.type}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)] capitalize">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[featureRequest.status] ?? "bg-zinc-400"}`} />
            {featureRequest.status.replace("_", " ")}
          </span>
          <button
            className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-medium text-red-500 opacity-0 transition-all hover:border-red-200 hover:bg-red-50 focus:opacity-100 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(featureRequest.id);
            }}
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>

        <span className="tabular-nums text-[13px] font-semibold tracking-tight">
          {featureRequest.priority_score}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold leading-snug tracking-tight transition-colors group-hover:text-[var(--accent-hover)]">
        {featureRequest.title}
      </h3>

      {/* Description */}
      {featureRequest.problem_statement && (
        <p className="-mt-2 text-[13px] leading-relaxed text-[var(--ink-soft)] line-clamp-2">
          {featureRequest.problem_statement}
        </p>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-4 text-[12px] text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-1" title="Signals">
          <MessageSquare className="h-3 w-3" />
          {metrics?.signal_count ?? 0}
        </span>
        <span className="inline-flex items-center gap-1" title="Customers">
          <Users className="h-3 w-3" />
          {metrics?.unique_customers ?? 0}
        </span>
        <span className="inline-flex items-center gap-1" title="Companies">
          <Building2 className="h-3 w-3" />
          {metrics?.unique_companies ?? 0}
        </span>
        <span className={`inline-flex items-center gap-1 ${urgencyColor(metrics?.avg_urgency_score ?? 0)}`} title="Urgency">
          <Flame className="h-3 w-3" />
          {(metrics?.avg_urgency_score ?? 0).toFixed(1)}
        </span>
        <span className="inline-flex items-center gap-1" title="Trend">
          <TrendIcon direction={metrics?.trend_direction} />
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--line-soft)] pt-3">
        <div className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
          <span>{timeAgo(featureRequest.updated_at)}</span>
          {featureRequest.synthesis_confidence != null && (
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-600">
              {Math.round(featureRequest.synthesis_confidence)}%
            </span>
          )}
        </div>

        <ArrowRight className="h-3.5 w-3.5 text-[var(--ink-muted)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>
    </article>
  );
}
