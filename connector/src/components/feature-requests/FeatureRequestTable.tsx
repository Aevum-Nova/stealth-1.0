import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
} from "lucide-react";

import { getPrStatus } from "@/api/agent";
import PriorityBadge from "@/components/feature-requests/PriorityBadge";
import { timeAgo } from "@/lib/utils";
import type {
  FeatureRequest,
  FeatureRequestType,
} from "@/types/feature-request";

const TYPE_LABELS: Record<FeatureRequestType, string> = {
  feature: "Feature",
  bug_fix: "Bug Fix",
  improvement: "Improvement",
  integration: "Integration",
  ux_change: "UX Change",
};

function TrendIcon({ direction }: { direction?: string }) {
  const cls = "h-3 w-3";
  if (direction === "increasing")
    return <TrendingUp className={`${cls} text-emerald-500`} />;
  if (direction === "decreasing")
    return <TrendingDown className={`${cls} text-red-500`} />;
  return <Minus className={`${cls} text-[var(--ink-muted)]`} />;
}

function urgencyColor(score: number): string {
  if (score >= 8) return "text-red-500";
  if (score >= 5) return "text-amber-500";
  return "text-emerald-500";
}

type ColAlign = "left" | "center" | "right";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: ColAlign;
}

const DATA_COLUMNS: Column[] = [
  { key: "title", label: "Title", sortable: false, width: "minmax(280px, 2fr)" },
  { key: "type", label: "Type", sortable: false, width: "100px" },
  { key: "status", label: "Status", sortable: false, width: "88px" },
  { key: "priority", label: "Priority", sortable: false, width: "100px" },
  { key: "priority_score", label: "Score", sortable: true, width: "80px", align: "right" },
  { key: "signals", label: "Signals", sortable: false, width: "76px", align: "right" },
  { key: "customers", label: "Customers", sortable: false, width: "90px", align: "right" },
  { key: "companies", label: "Companies", sortable: false, width: "90px", align: "right" },
  { key: "urgency", label: "Urgency", sortable: false, width: "76px", align: "right" },
  { key: "trend", label: "Trend", sortable: false, width: "60px", align: "center" },
  { key: "updated_at", label: "Updated", sortable: true, width: "100px" },
];

const INDEX_COL: Column = {
  key: "_idx",
  label: "#",
  width: "40px",
  align: "center",
};

/** Grid lines on every cell (spreadsheet-style) */
const CELL_GRID =
  "box-border min-w-0 w-full border-b border-r border-[var(--line)] last:border-r-0";

function cellAlign(align?: ColAlign): string {
  if (align === "right") return "text-right justify-end";
  if (align === "center") return "text-center justify-center";
  return "text-left justify-start";
}

/** PR state for list cell: open / closed / merged, or unknown if no PR; … while loading */
function prStatusCellLabel(
  isPending: boolean,
  exists: boolean | undefined,
  state: string | undefined | null,
): string {
  if (isPending) return "…";
  if (exists && state) return state.toLowerCase();
  return "unknown";
}

interface FeatureRequestTableProps {
  items: FeatureRequest[];
  onDelete: (id: string) => void;
  sort?: string;
  order?: "asc" | "desc";
  onSort?: (field: string) => void;
  /** Edge-to-edge sheet layout (no rounded card container) */
  fullBleed?: boolean;
  /** Sticky header `top` offset — match overlay toolbar height (px) */
  stickyHeaderOffsetPx?: number;
}

export default function FeatureRequestTable({
  items,
  onDelete,
  sort,
  order,
  onSort,
  fullBleed = false,
  stickyHeaderOffsetPx = 0,
}: FeatureRequestTableProps) {
  const navigate = useNavigate();

  const prQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["pr-status", item.id],
      queryFn: () => getPrStatus(item.id),
      staleTime: 30_000,
    })),
  });

  const columns = useMemo(
    () => (fullBleed ? [INDEX_COL, ...DATA_COLUMNS] : DATA_COLUMNS),
    [fullBleed]
  );

  const gridTemplate = useMemo(
    () => columns.map((c) => c.width ?? "1fr").join(" "),
    [columns]
  );

  function SortIcon({ field }: { field: string }) {
    if (sort !== field)
      return <ArrowUpDown className="h-3 w-3 text-[var(--ink-muted)] opacity-0 transition-opacity group-hover/th:opacity-100" />;
    if (order === "asc")
      return <ArrowUp className="h-3 w-3 text-[var(--ink)]" />;
    return <ArrowDown className="h-3 w-3 text-[var(--ink)]" />;
  }

  const headerTop =
    fullBleed && stickyHeaderOffsetPx > 0 ? stickyHeaderOffsetPx : undefined;

  const sheetShell = fullBleed
    ? "min-h-full min-w-full border-x border-b border-[var(--line)] bg-[var(--surface)]"
    : "overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]";

  const headerGridClass = `grid items-stretch border-t border-[var(--line)] bg-[var(--surface-subtle)] ${
    fullBleed ? "sticky z-30 shadow-[0_1px_0_var(--line-soft)]" : ""
  }`;

  return (
    <div className={sheetShell}>
      {/* Header */}
      <div
        className={headerGridClass}
        style={{
          gridTemplateColumns: gridTemplate,
          ...(headerTop !== undefined ? { top: headerTop } : {}),
        }}
      >
        {columns.map((col) => {
          const isSort = col.sortable && onSort;
          return (
            <div
              key={col.key}
              className={`group/th flex items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] select-none ${CELL_GRID} ${cellAlign(col.align)} ${
                isSort ? "cursor-pointer hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]" : ""
              }`}
              onClick={() => isSort && onSort(col.key)}
            >
              {col.label}
              {isSort && <SortIcon field={col.key} />}
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {items.map((fr, rowIndex) => {
        const metrics = fr.impact_metrics;
        const prQuery = prQueries[rowIndex];
        const prPayload = prQuery?.data?.data;
        const prLabel = prStatusCellLabel(
          Boolean(prQuery?.isPending),
          prPayload?.exists,
          prPayload?.state,
        );

        return (
          <div
            key={fr.id}
            className="group grid cursor-pointer items-stretch transition-colors hover:bg-[var(--surface-hover)]"
            style={{ gridTemplateColumns: gridTemplate }}
            onClick={() => navigate(`/feature-requests/${fr.id}`)}
          >
            {fullBleed && (
              <div
                className={`flex items-center px-2 py-2 tabular-nums text-[12px] text-[var(--ink-muted)] ${CELL_GRID}`}
              >
                {rowIndex + 1}
              </div>
            )}

            {/* Title (+ delete — no separate actions column) */}
            <div
              className={`flex min-w-0 items-center gap-2 px-3 py-2 pr-3 ${CELL_GRID} ${cellAlign()}`}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug text-[var(--ink)] transition-colors group-hover:text-[var(--accent-hover)]">
                {fr.title}
              </span>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-[var(--ink-muted)] opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(fr.id);
                }}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Type */}
            <div className={`flex items-center px-3 py-2 ${CELL_GRID}`}>
              <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
                {TYPE_LABELS[fr.type] ?? fr.type}
              </span>
            </div>

            {/* Status — GitHub PR state (open / closed / merged) or unknown */}
            <div
              className={`flex items-center px-3 py-2 ${CELL_GRID} ${cellAlign()}`}
            >
              <span className="font-mono text-[12px] lowercase text-[var(--ink-soft)]">
                {prLabel}
              </span>
            </div>

            {/* Priority */}
            <div className={`flex items-center px-3 py-2 ${CELL_GRID}`}>
              <PriorityBadge priority={fr.priority} />
            </div>

            {/* Score */}
            <div
              className={`flex items-center px-3 py-2 tabular-nums text-[13px] font-semibold text-[var(--ink)] ${CELL_GRID} ${cellAlign("right")}`}
            >
              {fr.priority_score}
            </div>

            {/* Signals */}
            <div
              className={`px-3 py-2 tabular-nums text-[12px] text-[var(--ink-soft)] ${CELL_GRID} flex items-center ${cellAlign("right")}`}
            >
              {metrics?.signal_count ?? 0}
            </div>

            {/* Customers */}
            <div
              className={`px-3 py-2 tabular-nums text-[12px] text-[var(--ink-soft)] ${CELL_GRID} flex items-center ${cellAlign("right")}`}
            >
              {metrics?.unique_customers ?? 0}
            </div>

            {/* Companies */}
            <div
              className={`px-3 py-2 tabular-nums text-[12px] text-[var(--ink-soft)] ${CELL_GRID} flex items-center ${cellAlign("right")}`}
            >
              {metrics?.unique_companies ?? 0}
            </div>

            {/* Urgency */}
            <div
              className={`px-3 py-2 ${CELL_GRID} flex items-center ${cellAlign("right")}`}
            >
              <span
                className={`tabular-nums text-[12px] font-medium ${urgencyColor(metrics?.avg_urgency_score ?? 0)}`}
              >
                {(metrics?.avg_urgency_score ?? 0).toFixed(1)}
              </span>
            </div>

            {/* Trend */}
            <div
              className={`flex items-center justify-center px-3 py-2 ${CELL_GRID}`}
            >
              <TrendIcon direction={metrics?.trend_direction} />
            </div>

            {/* Updated */}
            <div
              className={`px-3 py-2 text-[12px] text-[var(--ink-muted)] ${CELL_GRID} flex items-center`}
            >
              {timeAgo(fr.updated_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
