import { Link } from "react-router-dom";
import {
  Eye,
  Check,
  X,
  MessageSquare,
  Users,
  Building2,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
} from "lucide-react";

import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import { timeAgo } from "@/lib/utils";
import type { FeatureRequest, FeatureRequestPriority, FeatureRequestType } from "@/types/feature-request";

const PRIORITY_BORDER: Record<FeatureRequestPriority, string> = {
  critical: "priority-left-critical",
  high: "priority-left-high",
  medium: "priority-left-medium",
  low: "priority-left-low",
};

const TYPE_LABELS: Record<FeatureRequestType, string> = {
  feature: "Feature",
  bug_fix: "Bug Fix",
  improvement: "Improvement",
  integration: "Integration",
  ux_change: "UX Change",
};

function TypeBadge({ type }: { type: FeatureRequestType }) {
  return (
    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 14;
  const stroke = 2;
  const size = 36;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke="var(--ink)" strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-semibold">{score}</span>
    </div>
  );
}

function TrendIcon({ direction }: { direction?: string }) {
  const cls = "h-3 w-3";
  if (direction === "increasing") return <TrendingUp className={`${cls} text-emerald-600`} />;
  if (direction === "decreasing") return <TrendingDown className={`${cls} text-red-500`} />;
  return <Minus className={`${cls} text-[var(--ink-muted)]`} />;
}

function urgencyColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 5) return "text-amber-500";
  return "text-emerald-600";
}

interface FeatureRequestCardProps {
  featureRequest: FeatureRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function FeatureRequestCard({ featureRequest, onApprove, onReject }: FeatureRequestCardProps) {
  const metrics = featureRequest.impact_metrics;

  return (
    <article className={`panel card-hover p-4 ${PRIORITY_BORDER[featureRequest.priority]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={featureRequest.priority} />
          <TypeBadge type={featureRequest.type} />
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
            {featureRequest.status}
          </span>
        </div>
        <ScoreRing score={featureRequest.priority_score} />
      </div>

      <Link
        to={`/feature-requests/${featureRequest.id}`}
        className="mt-2 block text-[15px] font-semibold tracking-tight hover:text-[var(--accent-hover)]"
      >
        {featureRequest.title}
      </Link>

      <p className="mt-1 text-[13px] text-[var(--ink-soft)] line-clamp-2">
        {featureRequest.problem_statement}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3.5 text-[12px] text-[var(--ink-muted)]">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          {metrics?.signal_count ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {metrics?.unique_customers ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {metrics?.unique_companies ?? 0}
        </span>
        <span className={`flex items-center gap-1 ${urgencyColor(metrics?.avg_urgency_score ?? 0)}`}>
          <Flame className="h-3 w-3" />
          {(metrics?.avg_urgency_score ?? 0).toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <TrendIcon direction={metrics?.trend_direction} />
          {metrics?.trend_direction ?? "stable"}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
          <span>{timeAgo(featureRequest.updated_at)}</span>
          {featureRequest.synthesis_confidence != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-600">
              <ShieldCheck className="h-3 w-3" />
              {Math.round(featureRequest.synthesis_confidence)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to={`/feature-requests/${featureRequest.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
          >
            <Eye className="h-3 w-3" />
            View
          </Link>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--action-primary)] px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)]"
            onClick={() => onApprove(featureRequest.id)}
          >
            <Check className="h-3 w-3" />
            Approve
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-600 hover:bg-red-100 transition-colors"
            onClick={() => onReject(featureRequest.id)}
          >
            <X className="h-3 w-3" />
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}
