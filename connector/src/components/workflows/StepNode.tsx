import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Boxes,
  Database,
  Sparkles,
  Lightbulb,
  GitPullRequest,
  Check,
  type LucideIcon,
} from "lucide-react";

import type { StepNode as StepNodeType } from "@/types/workflow";
import { STEP_META } from "@/types/workflow";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";

const ICONS: Record<string, LucideIcon> = {
  Boxes,
  Database,
  Sparkles,
  Lightbulb,
  GitPullRequest,
};

function StepNode({ data, selected }: NodeProps<StepNodeType>) {
  const meta = STEP_META[data.stepType];
  const Icon = ICONS[meta.icon] ?? Boxes;

  // Show connector logo for plugin nodes when a connector type is selected
  const connectorType = data.stepType === "plugin" ? data.config.connectorType : null;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-2 !border-[var(--surface)] !bg-[var(--ink-muted)]"
      />

      <div
        className={`group w-[220px] rounded-xl border bg-[var(--surface)] transition-all ${
          selected
            ? "border-[var(--ink)] shadow-[0_0_0_1px_var(--ink)]"
            : "border-[var(--line)] shadow-sm hover:border-[var(--line-muted)] hover:shadow-md"
        }`}
      >
        <div className="p-3.5">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: connectorType ? "var(--surface-subtle)" : `${meta.color}14` }}
            >
              {connectorType ? (
                <ConnectorLogo
                  icon={connectorType}
                  alt={connectorType}
                  className="size-5"
                />
              ) : (
                <span style={{ color: meta.color }}>
                  <Icon className="size-3.5" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-[var(--ink)]">
                {data.label || meta.label}
              </div>
              <div className="truncate text-[11px] text-[var(--ink-muted)]">
                {connectorType
                  ? connectorType.charAt(0).toUpperCase() + connectorType.slice(1)
                  : meta.description}
              </div>
            </div>
          </div>

          {/* Status */}
          {data.configured && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-md bg-[var(--surface-subtle)] px-2 py-1">
              <Check className="size-3 text-emerald-500" />
              <span className="text-[11px] text-[var(--ink-soft)]">
                Configured
              </span>
            </div>
          )}

          {/* Config summary */}
          {Object.keys(data.config).length > 0 && (
            <div className="mt-2 space-y-0.5">
              {Object.entries(data.config)
                .filter(([key]) => key !== "connectorType")
                .slice(0, 2)
                .map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 text-[11px]"
                  >
                    <span className="text-[var(--ink-muted)]">{key}:</span>
                    <span className="truncate text-[var(--ink-soft)]">
                      {value}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-[var(--surface)] !bg-[var(--ink-muted)]"
      />
    </>
  );
}

export default memo(StepNode);
