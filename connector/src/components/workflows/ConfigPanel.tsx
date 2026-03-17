import { useCallback, useEffect } from "react";
import {
  X,
  Boxes,
  Database,
  Sparkles,
  Lightbulb,
  GitPullRequest,
  type LucideIcon,
} from "lucide-react";

import type { StepNode, StepType } from "@/types/workflow";
import { STEP_META } from "@/types/workflow";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";

const ICONS: Record<string, LucideIcon> = {
  Boxes,
  Database,
  Sparkles,
  Lightbulb,
  GitPullRequest,
};

interface ConfigPanelProps {
  node: StepNode;
  onUpdate: (id: string, data: Partial<StepNode["data"]>) => void;
  onClose: () => void;
}

/* ── Shared form primitives ── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-[var(--ink-soft)]">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors focus:border-[var(--focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: string }[];
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputClass} resize-none`}
      />
    </Field>
  );
}

/* ── Connector type picker (visual grid) ── */

const CONNECTORS = [
  { value: "slack", label: "Slack" },
  { value: "github", label: "GitHub" },
  { value: "intercom", label: "Intercom" },
  { value: "zendesk", label: "Zendesk" },
  { value: "figma", label: "Figma" },
  { value: "teams", label: "Teams" },
  { value: "servicenow", label: "ServiceNow" },
  { value: "google_forms", label: "Google Forms" },
];

function ConnectorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label="Connector">
      <div className="grid grid-cols-4 gap-2">
        {CONNECTORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 transition-all ${
              value === c.value
                ? "border-[var(--ink)] bg-[var(--surface-subtle)]"
                : "border-[var(--line)] bg-[var(--canvas)] hover:border-[var(--line-muted)] hover:bg-[var(--surface-subtle)]"
            }`}
          >
            <ConnectorLogo icon={c.value} alt={c.label} className="size-6" />
            <span className="text-[10px] font-medium text-[var(--ink-soft)]">
              {c.label}
            </span>
          </button>
        ))}
      </div>
    </Field>
  );
}

/* ── Step-specific config forms ── */

function PluginConfig({
  config,
  updateConfig,
}: {
  config: Record<string, string>;
  updateConfig: (key: string, value: string) => void;
}) {
  return (
    <>
      <ConnectorPicker
        value={config.connectorType ?? ""}
        onChange={(v) => updateConfig("connectorType", v)}
      />
      <Input
        label="Display Name"
        value={config.displayName ?? ""}
        onChange={(v) => updateConfig("displayName", v)}
        placeholder="e.g. Production Slack"
      />
    </>
  );
}

function IngestTriggerConfig({
  config,
  updateConfig,
}: {
  config: Record<string, string>;
  updateConfig: (key: string, value: string) => void;
}) {
  return (
    <>
      <Input
        label="Trigger Name"
        value={config.triggerName ?? ""}
        onChange={(v) => updateConfig("triggerName", v)}
        placeholder="e.g. New message trigger"
      />
      <Textarea
        label="Description"
        value={config.description ?? ""}
        onChange={(v) => updateConfig("description", v)}
        placeholder="Describe what should trigger ingestion..."
      />
      <Select
        label="Frequency"
        value={config.frequency ?? ""}
        onChange={(v) => updateConfig("frequency", v)}
        options={[
          { value: "realtime", label: "Real-time" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
        ]}
      />
    </>
  );
}

function SynthesisTriggerConfig({
  config,
  updateConfig,
}: {
  config: Record<string, string>;
  updateConfig: (key: string, value: string) => void;
}) {
  return (
    <>
      <Input
        label="Label"
        value={config.label ?? ""}
        onChange={(v) => updateConfig("label", v)}
        placeholder="e.g. Feature extraction"
      />
      <Select
        label="Mode"
        value={config.mode ?? ""}
        onChange={(v) => updateConfig("mode", v)}
        options={[
          { value: "on_trigger", label: "On Trigger" },
          { value: "scheduled", label: "Scheduled" },
          { value: "manual", label: "Manual" },
        ]}
      />
      {config.mode === "scheduled" && (
        <Input
          label="Schedule (cron)"
          value={config.schedule ?? ""}
          onChange={(v) => updateConfig("schedule", v)}
          placeholder="e.g. 0 9 * * 1"
        />
      )}
      <Textarea
        label="Synthesis Prompt"
        value={config.prompt ?? ""}
        onChange={(v) => updateConfig("prompt", v)}
        placeholder="Describe what patterns to look for..."
      />
    </>
  );
}

function FeatureRequestConfig({
  config,
  updateConfig,
}: {
  config: Record<string, string>;
  updateConfig: (key: string, value: string) => void;
}) {
  return (
    <>
      <Input
        label="Label"
        value={config.label ?? ""}
        onChange={(v) => updateConfig("label", v)}
        placeholder="e.g. Auto-generated features"
      />
      <Select
        label="Priority Threshold"
        value={config.priorityThreshold ?? ""}
        onChange={(v) => updateConfig("priorityThreshold", v)}
        options={[
          { value: "all", label: "All" },
          { value: "medium", label: "Medium+" },
          { value: "high", label: "High+" },
          { value: "critical", label: "Critical only" },
        ]}
      />
      <Input
        label="Assignee"
        value={config.assignee ?? ""}
        onChange={(v) => updateConfig("assignee", v)}
        placeholder="e.g. team-leads"
      />
    </>
  );
}

function PullRequestConfig({
  config,
  updateConfig,
}: {
  config: Record<string, string>;
  updateConfig: (key: string, value: string) => void;
}) {
  return (
    <>
      <Input
        label="Label"
        value={config.label ?? ""}
        onChange={(v) => updateConfig("label", v)}
        placeholder="e.g. Auto PR creation"
      />
      <Select
        label="Target Repository"
        value={config.repo ?? ""}
        onChange={(v) => updateConfig("repo", v)}
        options={[
          { value: "main", label: "Main Repository" },
          { value: "frontend", label: "Frontend" },
          { value: "backend", label: "Backend" },
          { value: "custom", label: "Custom..." },
        ]}
      />
      {config.repo === "custom" && (
        <Input
          label="Repository URL"
          value={config.repoUrl ?? ""}
          onChange={(v) => updateConfig("repoUrl", v)}
          placeholder="https://github.com/org/repo"
        />
      )}
      <Input
        label="Base Branch"
        value={config.baseBranch ?? ""}
        onChange={(v) => updateConfig("baseBranch", v)}
        placeholder="e.g. main"
      />
    </>
  );
}

const CONFIG_FORMS: Record<
  StepType,
  React.ComponentType<{
    config: Record<string, string>;
    updateConfig: (key: string, value: string) => void;
  }>
> = {
  plugin: PluginConfig,
  ingestTrigger: IngestTriggerConfig,
  synthesisTrigger: SynthesisTriggerConfig,
  featureRequest: FeatureRequestConfig,
  pullRequest: PullRequestConfig,
};

/* ── Modal ── */

export default function ConfigPanel({
  node,
  onUpdate,
  onClose,
}: ConfigPanelProps) {
  const meta = STEP_META[node.data.stepType];
  const Icon = ICONS[meta.icon] ?? Boxes;
  const ConfigForm = CONFIG_FORMS[node.data.stepType];

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const updateConfig = useCallback(
    (key: string, value: string) => {
      const newConfig = { ...node.data.config, [key]: value };
      onUpdate(node.id, { config: newConfig });
    },
    [node.id, node.data.config, onUpdate],
  );

  const updateLabel = useCallback(
    (label: string) => {
      onUpdate(node.id, { label });
    },
    [node.id, onUpdate],
  );

  const toggleConfigured = useCallback(() => {
    onUpdate(node.id, { configured: !node.data.configured });
  }, [node.id, node.data.configured, onUpdate]);

  const connectorType =
    node.data.stepType === "plugin" ? node.data.config.connectorType : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-xl"
              style={{
                background: connectorType ? "var(--surface-subtle)" : `${meta.color}14`,
              }}
            >
              {connectorType ? (
                <ConnectorLogo
                  icon={connectorType}
                  alt={connectorType}
                  className="size-5"
                />
              ) : (
                <span style={{ color: meta.color }}>
                  <Icon className="size-4" />
                </span>
              )}
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--ink)]">
                {node.data.label || meta.label}
              </h2>
              <p className="text-[12px] text-[var(--ink-muted)]">
                {meta.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
          <Input
            label="Step Name"
            value={node.data.label}
            onChange={updateLabel}
            placeholder={meta.label}
          />

          <div className="border-t border-[var(--line-soft)]" />

          <ConfigForm config={node.data.config} updateConfig={updateConfig} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--line)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)]"
          >
            Cancel
          </button>
          <button
            onClick={toggleConfigured}
            className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
              node.data.configured
                ? "border border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)]"
                : "bg-[var(--ink)] text-white hover:bg-[var(--accent-hover)]"
            }`}
          >
            {node.data.configured ? "Mark incomplete" : "Mark as configured"}
          </button>
        </div>
      </div>
    </div>
  );
}
