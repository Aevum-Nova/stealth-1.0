import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import * as connectorsApi from "@/api/connectors";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import SlackChannelPicker from "@/components/connectors/SlackChannelPicker";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
import { useConnectors } from "@/hooks/use-connectors";
import { useTrigger, useTriggerConfig, useTriggerMutations, useTriggers } from "@/hooks/use-triggers";
import { formatDate, formatNumber, timeAgo } from "@/lib/utils";
import type {
  Trigger,
  TriggerBufferConfig,
  TriggerConnectorOption,
  TriggerMatchConfig,
  TriggerPayload,
  TriggerScopeField,
} from "@/types/trigger";

const DEFAULT_BUFFER_CONFIG: TriggerBufferConfig = {
  time_threshold_minutes: 60,
  count_threshold: 10,
  min_buffer_minutes: 5,
};

const DEFAULT_MATCH_CONFIG: TriggerMatchConfig = {
  confidence_threshold: 0.8,
};

function statusTone(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "paused") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (status === "error") return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  return "bg-[var(--accent-soft)] text-[var(--ink-muted)] ring-1 ring-[var(--line)]";
}

function statusDot(status: string) {
  if (status === "active") return "bg-emerald-500";
  if (status === "paused") return "bg-amber-500";
  if (status === "error") return "bg-rose-500";
  return "bg-gray-400";
}

/** Shared styles for trigger detail panel actions (edit / pause / delete). */
const triggerDetailActionBtn =
  "inline-flex min-h-8 min-w-[4.25rem] items-center justify-center rounded-lg border px-3 text-[11px] font-semibold tracking-[0.01em] transition-[background-color,border-color,color] duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:pointer-events-none disabled:opacity-45";

function collectScopeValues(scope: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const value of Object.values(scope)) {
    if (Array.isArray(value)) {
      values.push(...value.map(String));
    } else if (typeof value === "string" && value) {
      values.push(value);
    }
  }
  return values;
}

function buildSlackScopeLabel(scope: Record<string, unknown>, channelNames?: Map<string, string>): string | null {
  const ids = collectScopeValues(scope);
  if (!ids.length || !channelNames) return null;
  const names = ids.map((id) => channelNames.get(id)).filter((name): name is string => Boolean(name));
  if (names.length !== ids.length) return null;
  return names.map((name) => `#${name}`).join(", ");
}

function makeEmptyPayload(connector?: TriggerConnectorOption): TriggerPayload {
  const scope: Record<string, unknown> = {};
  for (const field of connector?.scope_fields ?? []) {
    scope[field.key] = field.multiple ? [] : "";
  }
  return {
    connector_id: connector?.connector_id ?? "",
    natural_language_description: "",
    scope,
    buffer_config: { ...DEFAULT_BUFFER_CONFIG },
    match_config: { ...DEFAULT_MATCH_CONFIG },
    status: "active",
  };
}

function buildPayloadFromTrigger(trigger: Trigger, connector?: TriggerConnectorOption): TriggerPayload {
  const payload = makeEmptyPayload(connector);
  payload.connector_id = trigger.connector.id;
  payload.natural_language_description = trigger.natural_language_description;
  payload.scope = { ...payload.scope, ...trigger.scope };
  payload.buffer_config = { ...DEFAULT_BUFFER_CONFIG, ...trigger.buffer_config };
  payload.match_config = { ...DEFAULT_MATCH_CONFIG, ...trigger.match_config };
  payload.status = trigger.status;
  return payload;
}

/* ── Custom source picker with logos ────────────────────────────── */
function SourcePicker({
  connectors,
  value,
  disabled,
  onChange,
}: {
  connectors: TriggerConnectorOption[];
  value: string;
  disabled?: boolean;
  onChange: (connector: TriggerConnectorOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = connectors.find((c) => c.connector_id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
      >
        {selected ? (
          <>
            <ConnectorLogo icon={selected.icon} alt={selected.display_name} className="size-5 shrink-0 object-contain" />
            <span className="flex-1 font-medium">{selected.display_name}</span>
          </>
        ) : (
          <span className="flex-1 text-[var(--ink-muted)]">Select a source</span>
        )}
        <svg className={`size-4 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg border border-[var(--line)] bg-white shadow-lg">
          {connectors.map((c) => (
            <button
              key={c.connector_id}
              type="button"
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-[var(--accent-soft)] ${
                c.connector_id === value ? "bg-[var(--accent-soft)] font-medium" : ""
              }`}
              onClick={() => { onChange(c); setOpen(false); }}
            >
              <ConnectorLogo icon={c.icon} alt={c.display_name} className="size-5 shrink-0 object-contain" />
              <span className="text-[var(--ink)]">{c.display_name}</span>
              {c.status !== "connected" ? (
                <span className="ml-auto text-[11px] text-amber-600">needs auth</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Generic scope field ───────────────────────────────────────── */
function ScopeField({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: TriggerScopeField;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  const normalized = field.multiple ? (Array.isArray(value) ? value.map(String) : []) : String(value ?? "");

  return (
    <label className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-[var(--ink)]">{field.label}</span>
        {field.required ? <span className="text-[11px] text-[var(--ink-muted)]">required</span> : null}
      </div>
      <select
        multiple={field.multiple}
        value={normalized}
        disabled={disabled}
        onChange={(event) => {
          if (field.multiple) {
            onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value));
            return;
          }
          onChange(event.currentTarget.value);
        }}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
      >
        {!field.multiple ? <option value="">All</option> : null}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {field.help ? <p className="text-[12px] text-[var(--ink-muted)]">{field.help}</p> : null}
    </label>
  );
}

export default function TriggersPage() {
  const configQuery = useTriggerConfig();
  const connectorsQuery = useConnectors();
  const triggersQuery = useTriggers();
  const { pushToast } = useToast();
  const { createTrigger, updateTrigger, deleteTrigger, pauseTrigger, resumeTrigger } = useTriggerMutations();

  const connectors = configQuery.data?.data ?? [];
  const triggers = triggersQuery.data?.data ?? [];
  const savedConnectors = connectorsQuery.data?.data ?? [];

  const slackTriggerConnectorIds = useMemo(
    () => Array.from(new Set(triggers.filter((trigger) => trigger.plugin_type === "slack").map((trigger) => trigger.connector.id))),
    [triggers],
  );

  const slackChannelQueries = useQueries({
    queries: slackTriggerConnectorIds.map((connectorId) => ({
      queryKey: ["connector", connectorId, "slack-channels"],
      queryFn: () => connectorsApi.getSlackChannels(connectorId),
      enabled: Boolean(connectorId),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const slackChannelNamesByConnector = useMemo(() => {
    const namesByConnector = new Map<string, Map<string, string>>();

    for (const connector of savedConnectors) {
      if (connector.type !== "slack") continue;
      const names = new Map<string, string>();
      const configuredNames = connector.config?.channel_names;
      if (configuredNames && typeof configuredNames === "object") {
        for (const [id, name] of Object.entries(configuredNames as Record<string, unknown>)) {
          if (typeof name === "string" && name.trim()) {
            names.set(id, name);
          }
        }
      }
      namesByConnector.set(connector.id, names);
    }

    slackChannelQueries.forEach((query, index) => {
      const connectorId = slackTriggerConnectorIds[index];
      if (!connectorId) return;
      const names = namesByConnector.get(connectorId) ?? new Map<string, string>();
      for (const channel of query.data?.data ?? []) {
        names.set(channel.id, channel.name);
      }
      namesByConnector.set(connectorId, names);
    });

    return namesByConnector;
  }, [savedConnectors, slackChannelQueries, slackTriggerConnectorIds]);

  const waitingForSlackChannelNames = useMemo(() => {
    if (connectorsQuery.isLoading) {
      return triggers.some((trigger) => trigger.plugin_type === "slack" && collectScopeValues(trigger.scope).length > 0);
    }

    return triggers.some((trigger) => {
      if (trigger.plugin_type !== "slack") return false;
      const scopeIds = collectScopeValues(trigger.scope);
      if (!scopeIds.length) return false;

      const channelNames = slackChannelNamesByConnector.get(trigger.connector.id);
      const hasAllNames = scopeIds.every((id) => channelNames?.has(id));
      if (hasAllNames) return false;

      const queryIndex = slackTriggerConnectorIds.indexOf(trigger.connector.id);
      const query = queryIndex >= 0 ? slackChannelQueries[queryIndex] : undefined;
      return !query || query.isPending;
    });
  }, [connectorsQuery.isLoading, slackChannelNamesByConnector, slackChannelQueries, slackTriggerConnectorIds, triggers]);

  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState<TriggerPayload>(makeEmptyPayload());

  const selectedConnector = useMemo(
    () => connectors.find((item) => item.connector_id === form.connector_id),
    [connectors, form.connector_id],
  );

  const selectedDetailQuery = useTrigger(selectedTriggerId ?? undefined);

  useEffect(() => {
    if (!connectors.length) return;
    setForm((current) => {
      if (current.connector_id) return current;
      return makeEmptyPayload(connectors[0]);
    });
  }, [connectors]);

  useEffect(() => {
    if (!triggers.length) {
      setSelectedTriggerId(null);
      return;
    }
    if (selectedTriggerId && !triggers.some((item) => item.id === selectedTriggerId)) {
      setSelectedTriggerId(null);
    }
  }, [selectedTriggerId, triggers]);

  const startCreate = (connector = connectors[0]) => {
    setEditingTriggerId(null);
    setShowAdvanced(false);
    setShowForm(true);
    setForm(makeEmptyPayload(connector));
  };

  const startEdit = (trigger: Trigger) => {
    const connector = connectors.find((item) => item.connector_id === trigger.connector.id);
    setEditingTriggerId(trigger.id);
    setShowAdvanced(true);
    setShowForm(true);
    setForm(buildPayloadFromTrigger(trigger, connector));
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTriggerId(null);
  };

  const handleScopeChange = (key: string, next: unknown) => {
    setForm((current) => ({
      ...current,
      scope: { ...current.scope, [key]: next },
    }));
  };

  const submit = () => {
    const payload: TriggerPayload = {
      ...form,
      natural_language_description: form.natural_language_description.trim(),
      scope: Object.fromEntries(
        Object.entries(form.scope).filter(([, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return String(value ?? "").trim().length > 0;
        }),
      ),
    };

    if (!payload.connector_id || payload.natural_language_description.length < 8) {
      pushToast("Add a connector and describe what the trigger should watch.", "error");
      return;
    }

    if (editingTriggerId) {
      updateTrigger.mutate(
        {
          id: editingTriggerId,
          payload: {
            natural_language_description: payload.natural_language_description,
            scope: payload.scope,
            buffer_config: payload.buffer_config,
            match_config: payload.match_config,
            status: payload.status,
          },
        },
        {
          onSuccess: (response) => {
            setSelectedTriggerId(response.data.id);
            closeForm();
            pushToast("Trigger updated", "success");
          },
          onError: () => pushToast("Failed to update trigger", "error"),
        },
      );
      return;
    }

    createTrigger.mutate(payload, {
      onSuccess: (response) => {
        setSelectedTriggerId(response.data.id);
        closeForm();
        pushToast("Trigger created", "success");
      },
      onError: () => pushToast("Failed to create trigger", "error"),
    });
  };

  if (configQuery.isLoading || triggersQuery.isLoading) {
    return <LoadingSpinner label="Loading triggers" />;
  }

  if (waitingForSlackChannelNames) {
    return <LoadingSpinner label="Loading channel names" />;
  }

  if (configQuery.isError || triggersQuery.isError) {
    return <EmptyState title="Triggers unavailable" description="Could not load trigger configuration." />;
  }

  if (!connectors.length) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Triggers</h2>
          <p className="text-[13px] text-[var(--ink-soft)]">
            Automatically capture and process signals from your connected sources.
          </p>
        </div>
        <EmptyState
          title="No connectors available"
          description="Connect a data source like Slack before creating triggers."
          action={
            <Link
              to="/connectors"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Go to Connectors
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          }
        />
      </div>
    );
  }

  const selectedDetail = selectedDetailQuery.data?.data;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Triggers</h2>
          <p className="text-[13px] text-[var(--ink-soft)]">
            Automatically capture and process signals from your connected sources.
          </p>
        </div>
        {!showForm ? (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            onClick={() => startCreate()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New Trigger
          </button>
        ) : null}
      </div>

      {/* Create form (new triggers only — edit forms render in-place below) */}
      {showForm && !editingTriggerId ? (
        <div className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                {editingTriggerId ? "Edit Trigger" : "New Trigger"}
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                Pick a source, describe what to capture, and configure scope.
              </p>
            </div>
            <button
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--accent-soft)]"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="max-w-sm space-y-1.5">
              <span className="text-[13px] font-medium text-[var(--ink)]">Source</span>
              <SourcePicker
                connectors={connectors}
                value={form.connector_id}
                disabled={Boolean(editingTriggerId)}
                onChange={(next) => setForm(makeEmptyPayload(next))}
              />
            </div>

            <label className="block space-y-1.5">
              <span className="text-[13px] font-medium text-[var(--ink)]">What should this trigger capture?</span>
              <textarea
                value={form.natural_language_description}
                onChange={(event) => { const value = event.currentTarget.value; setForm((current) => ({ ...current, natural_language_description: value })); }}
                placeholder="e.g. bug reports from customers, negative feedback on checkout, requests for dark mode"
                rows={2}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
              />
            </label>

            {selectedConnector?.scope_fields.length ? (
              <div className="space-y-3">
                {selectedConnector.scope_fields.map((field) => (
                  selectedConnector.plugin_type === "slack" && field.key.includes("channel") ? (
                    <div key={field.key} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[var(--ink)]">{field.label}</span>
                        <span className="text-[12px] text-[var(--ink-muted)]">choose where to pull from</span>
                      </div>
                      <SlackChannelPicker
                        connectorId={form.connector_id}
                        initialChannelIds={Array.isArray(form.scope[field.key]) ? (form.scope[field.key] as string[]) : []}
                        onChange={(ids) => handleScopeChange(field.key, ids)}
                      />
                    </div>
                  ) : (
                    <ScopeField
                      key={field.key}
                      field={field}
                      value={form.scope[field.key]}
                      onChange={(next) => handleScopeChange(field.key, next)}
                    />
                  )
                ))}
              </div>
            ) : null}

            <div className="border-t border-[var(--line)] pt-3">
                <button
                  className="text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
                  onClick={() => setShowAdvanced((current) => !current)}
                >
                  {showAdvanced ? "Hide advanced settings" : "Advanced settings"}
                </button>
                {showAdvanced ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[12px] font-medium text-[var(--ink-soft)]">Time threshold (min)</span>
                      <input
                        type="number"
                        min={1}
                        value={form.buffer_config.time_threshold_minutes}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          buffer_config: { ...current.buffer_config, time_threshold_minutes: Number(event.currentTarget.value || 60) },
                        }))}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[12px] font-medium text-[var(--ink-soft)]">Count threshold</span>
                      <input
                        type="number"
                        min={1}
                        value={form.buffer_config.count_threshold}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          buffer_config: { ...current.buffer_config, count_threshold: Number(event.currentTarget.value || 10) },
                        }))}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[12px] font-medium text-[var(--ink-soft)]">Min buffer (min)</span>
                      <input
                        type="number"
                        min={0}
                        value={form.buffer_config.min_buffer_minutes}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          buffer_config: { ...current.buffer_config, min_buffer_minutes: Number(event.currentTarget.value || 0) },
                        }))}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[12px] font-medium text-[var(--ink-soft)]">Match confidence</span>
                      <input
                        type="number"
                        min={0.1}
                        max={0.99}
                        step={0.05}
                        value={form.match_config.confidence_threshold}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          match_config: { ...current.match_config, confidence_threshold: Number(event.currentTarget.value || 0.8) },
                        }))}
                        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-[var(--line)] pt-4">
            <button
              className="rounded-lg bg-[var(--ink)] px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
              disabled={createTrigger.isPending || updateTrigger.isPending}
              onClick={submit}
            >
              {createTrigger.isPending || updateTrigger.isPending
                ? "Saving..."
                : editingTriggerId
                  ? "Save Changes"
                  : "Create Trigger"}
            </button>
            <button
              className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Trigger list */}
      {triggers.length === 0 && !showForm ? (
        <EmptyState
          title="No triggers yet"
          description="Create a trigger to start automatically capturing signals from your connected sources."
          action={
            <button
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
              onClick={() => startCreate()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Create your first trigger
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => {
            const isSelected = selectedTriggerId === trigger.id;
            const isEditing = editingTriggerId === trigger.id && showForm;
            const scopeLabel = trigger.plugin_type === "slack"
              ? buildSlackScopeLabel(trigger.scope, slackChannelNamesByConnector.get(trigger.connector.id))
              : trigger.scope_summary;
            if (isEditing) {
              return (
                <div key={trigger.id} className="panel p-5">
                  <div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-[var(--ink)]">Edit Trigger</h3>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
                        Pick a source, describe what to capture, and configure scope.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="max-w-sm space-y-1.5">
                      <span className="text-[13px] font-medium text-[var(--ink)]">Source</span>
                      <SourcePicker connectors={connectors} value={form.connector_id} disabled onChange={() => {}} />
                    </div>
                    <label className="block space-y-1.5">
                      <span className="text-[13px] font-medium text-[var(--ink)]">What should this trigger capture?</span>
                      <textarea value={form.natural_language_description} onChange={(e) => { const v = e.currentTarget.value; setForm((cur) => ({ ...cur, natural_language_description: v })); }} placeholder="e.g. bug reports from customers" rows={2} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]" />
                    </label>
                    {selectedConnector?.scope_fields.length ? (
                      <div className="space-y-3">
                        {selectedConnector.scope_fields.map((field) =>
                          selectedConnector.plugin_type === "slack" && field.key.includes("channel") ? (
                            <div key={field.key} className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-[var(--ink)]">{field.label}</span>
                                <span className="text-[12px] text-[var(--ink-muted)]">choose where to pull from</span>
                              </div>
                              <SlackChannelPicker connectorId={form.connector_id} initialChannelIds={Array.isArray(form.scope[field.key]) ? (form.scope[field.key] as string[]) : []} onChange={(ids) => handleScopeChange(field.key, ids)} />
                            </div>
                          ) : (
                            <ScopeField key={field.key} field={field} value={form.scope[field.key]} onChange={(next) => handleScopeChange(field.key, next)} />
                          ),
                        )}
                      </div>
                    ) : null}
                    <div className="border-t border-[var(--line)] pt-3">
                      <button className="text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]" onClick={() => setShowAdvanced((c) => !c)}>
                        {showAdvanced ? "Hide advanced settings" : "Advanced settings"}
                      </button>
                      {showAdvanced ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1"><span className="text-[12px] font-medium text-[var(--ink-soft)]">Time threshold (min)</span><input type="number" min={1} value={form.buffer_config.time_threshold_minutes} onChange={(e) => setForm((cur) => ({ ...cur, buffer_config: { ...cur.buffer_config, time_threshold_minutes: Number(e.currentTarget.value || 60) } }))} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]" /></label>
                          <label className="space-y-1"><span className="text-[12px] font-medium text-[var(--ink-soft)]">Count threshold</span><input type="number" min={1} value={form.buffer_config.count_threshold} onChange={(e) => setForm((cur) => ({ ...cur, buffer_config: { ...cur.buffer_config, count_threshold: Number(e.currentTarget.value || 10) } }))} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]" /></label>
                          <label className="space-y-1"><span className="text-[12px] font-medium text-[var(--ink-soft)]">Min buffer (min)</span><input type="number" min={0} value={form.buffer_config.min_buffer_minutes} onChange={(e) => setForm((cur) => ({ ...cur, buffer_config: { ...cur.buffer_config, min_buffer_minutes: Number(e.currentTarget.value || 0) } }))} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]" /></label>
                          <label className="space-y-1"><span className="text-[12px] font-medium text-[var(--ink-soft)]">Match confidence</span><input type="number" min={0.1} max={0.99} step={0.05} value={form.match_config.confidence_threshold} onChange={(e) => setForm((cur) => ({ ...cur, match_config: { ...cur.match_config, confidence_threshold: Number(e.currentTarget.value || 0.7) } }))} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)]" /></label>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-3 border-t border-[var(--line)] pt-4">
                    <button className="rounded-lg bg-[var(--ink)] px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50" disabled={updateTrigger.isPending} onClick={submit}>{updateTrigger.isPending ? "Saving..." : "Save Changes"}</button>
                    <button className="rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]" onClick={closeForm}>Cancel</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={trigger.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTriggerId(isSelected ? null : trigger.id)}
                  className={`panel w-full text-left ${isSelected ? "" : "card-hover"}`}
                  style={isSelected ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: "transparent" } : undefined}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3.5">
                      <ConnectorLogo icon={trigger.connector.icon} alt={trigger.connector.display_name} className="mt-0.5 size-9 shrink-0 object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug text-[var(--ink)]">
                          {trigger.natural_language_description}
                        </p>
                        {scopeLabel ? (
                          <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">{scopeLabel}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`size-2 rounded-full ${statusDot(trigger.status)}`} />
                        <span className="text-[12px] capitalize text-[var(--ink-muted)]">{trigger.status}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3 text-[13px] text-[var(--ink-muted)]">
                      <span>{formatNumber(trigger.stats.matched_events_last_24h)} signals captured today</span>
                      <span>·</span>
                      <span>
                        {trigger.last_event_at ? `Last activity ${timeAgo(trigger.last_event_at)}` : "No activity yet"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isSelected ? (
                  <div className="panel p-5" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                    {selectedDetailQuery.isLoading ? (
                      <LoadingSpinner label="Loading activity" />
                    ) : selectedDetailQuery.isError || !selectedDetail ? (
                      <p className="text-[13px] text-[var(--ink-soft)]">Could not load trigger details.</p>
                    ) : (
                      <>
                        {/* Actions bar */}
                        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-4">
                          <button
                            type="button"
                            className={`${triggerDetailActionBtn} border-slate-700 bg-slate-900 text-white hover:border-slate-600 hover:bg-slate-800 focus:ring-slate-300`}
                            onClick={(e) => { e.stopPropagation(); startEdit(selectedDetail.trigger); }}
                          >
                            Edit
                          </button>
                          {selectedDetail.trigger.status === "active" ? (
                            <button
                              type="button"
                              className={`${triggerDetailActionBtn} border-cyan-700 bg-cyan-700 text-white hover:border-cyan-600 hover:bg-cyan-600 focus:ring-cyan-200`}
                              disabled={pauseTrigger.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                pauseTrigger.mutate(trigger.id, {
                                  onSuccess: () => pushToast("Trigger paused", "success"),
                                  onError: () => pushToast("Failed to pause trigger", "error"),
                                });
                              }}
                            >
                              {pauseTrigger.isPending ? "Pausing..." : "Pause"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${triggerDetailActionBtn} border-emerald-700 bg-emerald-700 text-white hover:border-emerald-600 hover:bg-emerald-600 focus:ring-emerald-200`}
                              disabled={resumeTrigger.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                resumeTrigger.mutate(trigger.id, {
                                  onSuccess: () => pushToast("Trigger resumed", "success"),
                                  onError: () => pushToast("Failed to resume trigger", "error"),
                                });
                              }}
                            >
                              {resumeTrigger.isPending ? "Resuming..." : "Resume"}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${triggerDetailActionBtn} border-rose-700 bg-rose-700 text-white hover:border-rose-600 hover:bg-rose-600 focus:ring-rose-200`}
                            disabled={deleteTrigger.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTrigger.mutate(trigger.id, {
                                onSuccess: () => pushToast("Trigger deleted", "success"),
                                onError: () => pushToast("Failed to delete trigger", "error"),
                              });
                            }}
                          >
                            {deleteTrigger.isPending ? "Deleting..." : "Delete"}
                          </button>
                          <span className="ml-auto text-[12px] text-[var(--ink-muted)]">
                            Created {formatDate(selectedDetail.trigger.created_at)}
                            {selectedDetail.trigger.last_dispatch_at
                              ? ` · Last dispatch ${formatDate(selectedDetail.trigger.last_dispatch_at)}`
                              : ""}
                          </span>
                        </div>

                        {selectedDetail.trigger.last_error ? (
                          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
                            {selectedDetail.trigger.last_error}
                          </div>
                        ) : null}

                        {/* Activity grid */}
                        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                          {/* Events */}
                          <div>
                            <h4 className="text-[13px] font-semibold text-[var(--ink)]">Recent Matched Events</h4>
                            {selectedDetail.recent_events.length === 0 ? (
                              <p className="mt-3 text-[13px] text-[var(--ink-muted)]">No matched events yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {selectedDetail.recent_events.map((event) => (
                                  <div key={event.id} className="rounded-lg border border-[var(--line)] px-3.5 py-3">
                                    <div className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                                      <span>{event.source_label}</span>
                                      {event.match_score != null ? (
                                        <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-medium">
                                          {(event.match_score * 100).toFixed(0)}% match
                                        </span>
                                      ) : null}
                                      <span className="ml-auto">{timeAgo(event.created_at)}</span>
                                    </div>
                                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink)]">
                                      {event.content_text || "No text extracted."}
                                    </p>
                                    {event.author_name || event.feature_requests.length ? (
                                      <div className="mt-2 flex flex-wrap gap-x-3 text-[12px] text-[var(--ink-soft)]">
                                        {event.author_name ? <span>by {event.author_name}</span> : null}
                                        {event.feature_requests.length ? (
                                          <span>FR: {event.feature_requests.map((item) => item.title).join(", ")}</span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Buffers */}
                          <div>
                            <h4 className="text-[13px] font-semibold text-[var(--ink)]">Buffer Timeline</h4>
                            {selectedDetail.recent_buffers.length === 0 ? (
                              <p className="mt-3 text-[13px] text-[var(--ink-muted)]">No buffer history yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {selectedDetail.recent_buffers.map((buffer) => (
                                  <div key={buffer.id} className="rounded-lg border border-[var(--line)] px-3.5 py-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[13px] font-medium text-[var(--ink)]">
                                        {formatNumber(buffer.event_count)} events
                                      </p>
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(buffer.status)}`}>
                                        {buffer.status}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 space-y-0.5 text-[12px] text-[var(--ink-muted)]">
                                      <p>Opened {formatDate(buffer.buffer_started_at)}</p>
                                      {buffer.dispatched_at ? <p>Dispatched {formatDate(buffer.dispatched_at)}</p> : null}
                                      {buffer.completed_at ? <p>Completed {formatDate(buffer.completed_at)}</p> : null}
                                      {buffer.feature_request_ids.length ? (
                                        <p>{buffer.feature_request_ids.length} feature requests created</p>
                                      ) : null}
                                      {buffer.error ? <p className="text-rose-600">{buffer.error}</p> : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
