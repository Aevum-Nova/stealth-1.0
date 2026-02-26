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

/* ── Inline helpers ─────────────────────────────────────────── */

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
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 16;
  const stroke = 3;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
      <svg width={40} height={40} className="-rotate-90">
        <circle
          cx={20}
          cy={20}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={20}
          cy={20}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-semibold">{score}</span>
    </div>
  );
}

function TrendIcon({ direction }: { direction?: string }) {
  const cls = "h-3.5 w-3.5";
  if (direction === "increasing") return <TrendingUp className={`${cls} text-emerald-600`} />;
  if (direction === "decreasing") return <TrendingDown className={`${cls} text-rose-600`} />;
  return <Minus className={`${cls} text-[var(--ink-soft)]`} />;
}

function urgencyColor(score: number): string {
  if (score >= 8) return "text-rose-600";
  if (score >= 5) return "text-amber-600";
  return "text-emerald-600";
}

/* ── Card ───────────────────────────────────────────────────── */

interface FeatureRequestCardProps {
  featureRequest: FeatureRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function FeatureRequestCard({ featureRequest, onApprove, onReject }: FeatureRequestCardProps) {
  const metrics = featureRequest.impact_metrics;

  return (
    <article
      className={`panel elevated card-hover p-4 ${PRIORITY_BORDER[featureRequest.priority]}`}
    >
      {/* 1. Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={featureRequest.priority} />
          <TypeBadge type={featureRequest.type} />
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{featureRequest.status}</span>
        </div>
        <ScoreRing score={featureRequest.priority_score} />
      </div>

      {/* 2. Title */}
      <Link
        to={`/feature-requests/${featureRequest.id}`}
        className="mt-2 block text-lg font-semibold hover:text-[var(--accent)]"
      >
        {featureRequest.title}
      </Link>

      {/* 3. Problem statement */}
      <p className="mt-1 text-sm text-[var(--ink-soft)] line-clamp-2">
        {featureRequest.problem_statement}
      </p>

      {/* 4. Metrics bar */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--ink-soft)]">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {metrics?.signal_count ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {metrics?.unique_customers ?? 0}
        </span>
        <span className="flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          {metrics?.unique_companies ?? 0}
        </span>
        <span className={`flex items-center gap-1 ${urgencyColor(metrics?.avg_urgency_score ?? 0)}`}>
          <Flame className="h-3.5 w-3.5" />
          {(metrics?.avg_urgency_score ?? 0).toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <TrendIcon direction={metrics?.trend_direction} />
          {metrics?.trend_direction ?? "stable"}
        </span>
      </div>

      {/* 5. Footer row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)]">
          <span>{timeAgo(featureRequest.updated_at)}</span>
          {featureRequest.synthesis_confidence != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
              <ShieldCheck className="h-3 w-3" />
              {Math.round(featureRequest.synthesis_confidence)}% confidence
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/feature-requests/${featureRequest.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--moss)] px-3 py-1.5 text-sm text-white"
            onClick={() => onApprove(featureRequest.id)}
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-200"
            onClick={() => onReject(featureRequest.id)}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}
