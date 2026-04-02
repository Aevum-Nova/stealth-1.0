import type { ReactNode } from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { SetupFlowState } from "@/lib/setup-flow";

interface SetupFlowPanelProps {
  flow: SetupFlowState;
  title: string;
  description: string;
  action?: ReactNode;
}

function statusLabel(status: SetupFlowState["steps"][number]["status"]) {
  if (status === "complete") return "Done";
  if (status === "current") return "Now";
  return "Later";
}

function statusTone(status: SetupFlowState["steps"][number]["status"]) {
  if (status === "complete") {
    return {
      badge: "bg-emerald-100 text-emerald-700",
      card: "border-emerald-200 bg-emerald-50/70",
      icon: "text-emerald-600",
    };
  }
  if (status === "current") {
    return {
      badge: "bg-[var(--action-primary)] text-white",
      card: "border-[var(--action-primary)] bg-white shadow-sm",
      icon: "text-[var(--action-primary)]",
    };
  }
  return {
    badge: "bg-[var(--accent-soft)] text-[var(--ink-muted)]",
    card: "border-[var(--line)] bg-[var(--surface)]",
    icon: "text-[var(--ink-muted)]",
  };
}

export default function SetupFlowPanel({ flow, title, description, action }: SetupFlowPanelProps) {
  return (
    <section className="panel overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Setup Flow
          </p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-[var(--ink)]">{title}</h3>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{description}</p>
          <p className="mt-3 text-[12px] text-[var(--ink-muted)]">
            {flow.completedSteps} of {flow.totalSteps} steps complete
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="grid gap-3 p-5 xl:grid-cols-5">
        {flow.steps.map((step, index) => {
          const tone = statusTone(step.status);

          return (
            <div key={step.key} className={`rounded-xl border p-4 ${tone.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {step.status === "complete" ? (
                    <CheckCircle2 className={`size-4 ${tone.icon}`} />
                  ) : (
                    <Circle className={`size-4 ${tone.icon}`} />
                  )}
                  <span className="text-[12px] font-medium text-[var(--ink-muted)]">Step {index + 1}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.badge}`}>
                  {statusLabel(step.status)}
                </span>
              </div>

              <h4 className="mt-4 text-[14px] font-semibold text-[var(--ink)]">{step.title}</h4>
              <p className="mt-1 text-[12px] leading-5 text-[var(--ink-soft)]">{step.description}</p>

              <Link
                to={step.href}
                className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--action-primary)] transition-colors hover:text-[var(--action-primary-hover)]"
              >
                Open
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
