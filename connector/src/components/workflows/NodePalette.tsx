import {
  Boxes,
  Database,
  Sparkles,
  Lightbulb,
  GitPullRequest,
  GripVertical,
  type LucideIcon,
} from "lucide-react";

import type { StepType } from "@/types/workflow";
import { STEP_META } from "@/types/workflow";

const ICONS: Record<string, LucideIcon> = {
  Boxes,
  Database,
  Sparkles,
  Lightbulb,
  GitPullRequest,
};

const STEP_ORDER: StepType[] = [
  "plugin",
  "ingestTrigger",
  "synthesisTrigger",
  "featureRequest",
  "pullRequest",
];

export default function NodePalette() {
  function onDragStart(
    event: React.DragEvent,
    stepType: StepType,
  ) {
    event.dataTransfer.setData("application/reactflow", stepType);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="absolute left-4 top-16 z-10 w-[200px] rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg">
      <div className="border-b border-[var(--line)] px-3.5 py-2.5">
        <h3 className="text-[12px] font-semibold text-[var(--ink)]">
          Steps
        </h3>
        <p className="text-[11px] text-[var(--ink-muted)]">
          Drag to canvas
        </p>
      </div>

      <div className="space-y-0.5 p-1.5">
        {STEP_ORDER.map((type) => {
          const meta = STEP_META[type];
          const Icon = ICONS[meta.icon] ?? Boxes;

          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className="flex cursor-grab items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--surface-subtle)] active:cursor-grabbing"
            >
              <GripVertical className="size-3 text-[var(--ink-muted)]" />
              <div
                className="flex size-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: `${meta.color}14` }}
              >
                <span style={{ color: meta.color }}>
                  <Icon className="size-3" />
                </span>
              </div>
              <span className="text-[12px] font-medium text-[var(--ink-soft)]">
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
