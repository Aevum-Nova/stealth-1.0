import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
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
  confidence_threshold: 0.7,
};

function statusTone(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "paused") return "bg-amber-50 text-amber-700";
  if (status === "error") return "bg-rose-50 text-rose-700";
  return "bg-[var(--accent-soft)] text-[var(--ink-muted)]";
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

function renderScopeField(
  field: TriggerScopeField,
  value: unknown,
  onChange: (next: unknown) => void,
  disabled = false,
) {
  const normalized = field.multiple ? (Array.isArray(value) ? value.map(String) : []) : String(value ?? "");

  return (
    <label key={field.key} className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[var(--ink)]">{field.label}</span>
        {field.required ? <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Required</span> : null}
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
        className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px]"
      >
        {!field.multiple ? <option value="">All</option> : null}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {field.help ? <p className="text-[12px] text-[var(--ink-soft)]">{field.help}</p> : null}
    </label>
  );
}

export default function TriggersPage() {
  const configQuery = useTriggerConfig();
  const triggersQuery = useTriggers();
  const { pushToast } = useToast();
  const { createTrigger, updateTrigger, deleteTrigger, pauseTrigger, resumeTrigger } = useTriggerMutations();

  const connectors = configQuery.data?.data ?? [];
  const triggers = triggersQuery.data?.data ?? [];

  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
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
    if (!selectedTriggerId || !triggers.some((item) => item.id === selectedTriggerId)) {
      setSelectedTriggerId(triggers[0].id);
    }
  }, [selectedTriggerId, triggers]);

  const connectedSources = connectors.length;
  const activeTriggers = triggers.filter((item) => item.status === "active").length;

  const startCreate = (connector = connectors[0]) => {
    setEditingTriggerId(null);
    setShowAdvanced(false);
    setForm(makeEmptyPayload(connector));
  };

  const startEdit = (trigger: Trigger) => {
    const connector = connectors.find((item) => item.connector_id === trigger.connector.id);
    setEditingTriggerId(trigger.id);
    setShowAdvanced(true);
    setForm(buildPayloadFromTrigger(trigger, connector));
  };

  const handleScopeChange = (key: string, next: unknown) => {
    setForm((current) => ({
      ...current,
      scope: {
        ...current.scope,
        [key]: next,
      },
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
        startCreate(connectors.find((item) => item.connector_id === payload.connector_id));
        pushToast("Trigger created", "success");
      },
      onError: () => pushToast("Failed to create trigger", "error"),
    });
  };

  if (configQuery.isLoading || triggersQuery.isLoading) {
    return <LoadingSpinner label="Loading triggers" />;
  }

  if (configQuery.isError || triggersQuery.isError) {
    return <EmptyState title="Triggers unavailable" description="Could not load trigger configuration." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Triggers</h2>
          <p className="text-[13px] text-[var(--ink-soft)]">
            Define what to listen for, where it should listen, and let ingestion plus synthesis run automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="panel min-w-28 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Connected Sources</p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{formatNumber(connectedSources)}</p>
          </div>
          <div className="panel min-w-28 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ink-muted)]">Active Triggers</p>
            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{formatNumber(activeTriggers)}</p>
          </div>
        </div>
      </div>

      {!connectors.length ? (
        <EmptyState
          title="No trigger-ready connectors"
          description="Connect Slack, Teams, Google Forms, Zendesk, Figma, or Intercom before creating a trigger."
          action={<Link to="/connectors" className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white">Open Connectors</Link>}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="space-y-4">
            <article className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-medium">{editingTriggerId ? "Edit Trigger" : "Create Trigger"}</h3>
                  <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                    Pick a connected plugin, describe the signal in plain English, then narrow the scope.
                  </p>
                </div>
                {editingTriggerId ? (
                  <button
                    className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)]"
                    onClick={() => startCreate(selectedConnector ?? connectors[0])}
                  >
                    New Trigger
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <label className="space-y-1.5">
                  <span className="text-[13px] font-medium">Connected plugin</span>
                  <select
                    value={form.connector_id}
                    disabled={Boolean(editingTriggerId)}
                    onChange={(event) => {
                      const next = connectors.find((item) => item.connector_id === event.currentTarget.value);
                      if (!next) return;
                      setForm(makeEmptyPayload(next));
                    }}
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px]"
                  >
                    {connectors.map((connector) => (
                      <option key={connector.connector_id} value={connector.connector_id}>
                        {connector.display_name} · {connector.connector_name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedConnector ? (
                  <div className="rounded-lg border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2.5 text-[12px] text-[var(--ink-soft)]">
                    <span className="font-medium text-[var(--ink)]">{selectedConnector.display_name}</span>
                    {` uses a ${selectedConnector.adapter_kind} listener.`}
                    {selectedConnector.install_hint ? ` ${selectedConnector.install_hint}` : ""}
                  </div>
                ) : null}

                <label className="space-y-1.5">
                  <span className="text-[13px] font-medium">What should this trigger capture?</span>
                  <textarea
                    value={form.natural_language_description}
                    onChange={(event) => setForm((current) => ({ ...current, natural_language_description: event.currentTarget.value }))}
                    placeholder="Examples: bug reports from customers in #product-feedback, negative feedback on checkout, requests for dark mode"
                    rows={4}
                    className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                  />
                </label>

                {selectedConnector?.scope_fields.length ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-[13px] font-medium text-[var(--ink)]">Scope</h4>
                      <p className="mt-1 text-[12px] text-[var(--ink-soft)]">Choose where the adapter should watch for matching events.</p>
                    </div>
                    {selectedConnector.scope_fields.map((field) =>
                      renderScopeField(field, form.scope[field.key], (next) => handleScopeChange(field.key, next), false),
                    )}
                  </div>
                ) : null}

                <div className="border-t border-[var(--line)] pt-3">
                  <button
                    className="text-[13px] font-medium text-[var(--accent)]"
                    onClick={() => setShowAdvanced((current) => !current)}
                  >
                    {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
                  </button>
                  {showAdvanced ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-[12px] font-medium">Time threshold (min)</span>
                        <input
                          type="number"
                          min={1}
                          value={form.buffer_config.time_threshold_minutes}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            buffer_config: { ...current.buffer_config, time_threshold_minutes: Number(event.currentTarget.value || 60) },
                          }))}
                          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[12px] font-medium">Count threshold</span>
                        <input
                          type="number"
                          min={1}
                          value={form.buffer_config.count_threshold}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            buffer_config: { ...current.buffer_config, count_threshold: Number(event.currentTarget.value || 10) },
                          }))}
                          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[12px] font-medium">Minimum buffer (min)</span>
                        <input
                          type="number"
                          min={0}
                          value={form.buffer_config.min_buffer_minutes}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            buffer_config: { ...current.buffer_config, min_buffer_minutes: Number(event.currentTarget.value || 0) },
                          }))}
                          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[12px] font-medium">Match confidence</span>
                        <input
                          type="number"
                          min={0.1}
                          max={0.99}
                          step={0.05}
                          value={form.match_config.confidence_threshold}
                          onChange={(event) => setForm((current) => ({
                            ...current,
                            match_config: { ...current.match_config, confidence_threshold: Number(event.currentTarget.value || 0.7) },
                          }))}
                          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[13px]"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>

                <button
                  className="w-full rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)]"
                  disabled={createTrigger.isPending || updateTrigger.isPending}
                  onClick={submit}
                >
                  {createTrigger.isPending || updateTrigger.isPending
                    ? "Saving..."
                    : editingTriggerId
                      ? "Save Trigger"
                      : "Create Trigger"}
                </button>
              </div>
            </article>

            <article className="panel p-4">
              <h3 className="text-[15px] font-medium">Connection Health</h3>
              <div className="mt-3 space-y-2">
                {connectors.map((connector) => (
                  <div key={connector.connector_id} className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5">
                    <ConnectorLogo icon={connector.icon} alt={connector.display_name} className="size-8 shrink-0 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--ink)]">{connector.display_name}</p>
                      <p className="truncate text-[12px] text-[var(--ink-soft)]">{connector.connector_name}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${connector.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {connector.status === "connected" ? "Ready" : "Needs auth"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="space-y-4">
            <article className="panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-medium">Live Triggers</h3>
                  <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Cards show scope, activity in the last day, and feature-request output.</p>
                </div>
              </div>

              {triggers.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-soft)]">
                  No triggers yet. Create the first one from the panel on the left.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {triggers.map((trigger) => (
                    <button
                      key={trigger.id}
                      type="button"
                      onClick={() => setSelectedTriggerId(trigger.id)}
                      className={`panel card-hover text-left p-4 ${selectedTriggerId === trigger.id ? "border-[var(--ink)] shadow-sm" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <ConnectorLogo icon={trigger.connector.icon} alt={trigger.connector.display_name} className="size-9 shrink-0 object-contain" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[14px] font-medium text-[var(--ink)]">{trigger.connector.display_name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(trigger.status)}`}>
                              {trigger.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] text-[var(--ink)]">{trigger.natural_language_description}</p>
                          <p className="mt-1 text-[12px] text-[var(--ink-soft)]">{trigger.scope_summary}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[var(--ink-soft)]">
                        <span>{formatNumber(trigger.stats.matched_events_last_24h)} matched in 24h</span>
                        <span>{formatNumber(trigger.stats.feature_request_count)} feature requests</span>
                        <span>{formatNumber(trigger.stats.open_buffer_events)} buffered now</span>
                      </div>

                      <div className="mt-3 text-[12px] text-[var(--ink-muted)]">
                        {trigger.last_event_at ? `Last event ${timeAgo(trigger.last_event_at)}` : "No events yet"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </article>

            {selectedTriggerId ? (
              <article className="panel p-4">
                {selectedDetailQuery.isLoading ? (
                  <LoadingSpinner label="Loading trigger detail" />
                ) : selectedDetailQuery.isError || !selectedDetailQuery.data?.data ? (
                  <EmptyState title="Trigger detail unavailable" description="Could not load the activity feed." />
                ) : (
                  <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-medium">Activity Feed</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(selectedDetailQuery.data.data.trigger.status)}`}>
                            {selectedDetailQuery.data.data.trigger.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{selectedDetailQuery.data.data.trigger.natural_language_description}</p>
                        <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                          Created {formatDate(selectedDetailQuery.data.data.trigger.created_at)}
                          {selectedDetailQuery.data.data.trigger.last_dispatch_at
                            ? ` · Last dispatch ${formatDate(selectedDetailQuery.data.data.trigger.last_dispatch_at)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)]"
                          onClick={() => startEdit(selectedDetailQuery.data.data.trigger)}
                        >
                          Edit
                        </button>
                        {selectedDetailQuery.data.data.trigger.status === "active" ? (
                          <button
                            className="rounded-lg border border-amber-200 px-3 py-1.5 text-[13px] font-medium text-amber-700 hover:bg-amber-50"
                            disabled={pauseTrigger.isPending}
                            onClick={() =>
                              pauseTrigger.mutate(selectedTriggerId, {
                                onSuccess: () => pushToast("Trigger paused", "success"),
                                onError: () => pushToast("Failed to pause trigger", "error"),
                              })
                            }
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50"
                            disabled={resumeTrigger.isPending}
                            onClick={() =>
                              resumeTrigger.mutate(selectedTriggerId, {
                                onSuccess: () => pushToast("Trigger resumed", "success"),
                                onError: () => pushToast("Failed to resume trigger", "error"),
                              })
                            }
                          >
                            Resume
                          </button>
                        )}
                        <button
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                          disabled={deleteTrigger.isPending}
                          onClick={() =>
                            deleteTrigger.mutate(selectedTriggerId, {
                              onSuccess: () => {
                                pushToast("Trigger deleted", "success");
                                startCreate(connectors[0]);
                              },
                              onError: () => pushToast("Failed to delete trigger", "error"),
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {selectedDetailQuery.data.data.trigger.last_error ? (
                      <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                        {selectedDetailQuery.data.data.trigger.last_error}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                      <div>
                        <h4 className="text-[13px] font-medium">Recent Matched Events</h4>
                        {selectedDetailQuery.data.data.recent_events.length === 0 ? (
                          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">No matched events yet.</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {selectedDetailQuery.data.data.recent_events.map((event) => (
                              <div key={event.id} className="rounded-lg border border-[var(--line)] px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                                  <span>{event.source_label}</span>
                                  {event.match_score !== null && event.match_score !== undefined ? (
                                    <span>match {(event.match_score * 100).toFixed(0)}%</span>
                                  ) : null}
                                  <span>{timeAgo(event.created_at)}</span>
                                </div>
                                <p className="mt-2 text-[13px] text-[var(--ink)]">{event.content_text || "No text extracted."}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--ink-soft)]">
                                  {event.author_name ? <span>Author: {event.author_name}</span> : null}
                                  <span>Status: {event.processing_status}</span>
                                  {event.feature_requests.length ? (
                                    <span>
                                      Feature requests: {event.feature_requests.map((item) => item.title).join(", ")}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-[13px] font-medium">Buffer Timeline</h4>
                        {selectedDetailQuery.data.data.recent_buffers.length === 0 ? (
                          <p className="mt-3 text-[13px] text-[var(--ink-soft)]">No buffer history yet.</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {selectedDetailQuery.data.data.recent_buffers.map((buffer) => (
                              <div key={buffer.id} className="rounded-lg border border-[var(--line)] px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[13px] font-medium text-[var(--ink)]">{formatNumber(buffer.event_count)} events</p>
                                    <p className="text-[12px] text-[var(--ink-soft)]">Opened {formatDate(buffer.buffer_started_at)}</p>
                                  </div>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone(buffer.status)}`}>
                                    {buffer.status}
                                  </span>
                                </div>
                                <div className="mt-2 space-y-1 text-[12px] text-[var(--ink-soft)]">
                                  {buffer.dispatched_at ? <p>Dispatched {formatDate(buffer.dispatched_at)}</p> : null}
                                  {buffer.completed_at ? <p>Completed {formatDate(buffer.completed_at)}</p> : null}
                                  {buffer.feature_request_ids.length ? <p>Feature requests created: {buffer.feature_request_ids.length}</p> : null}
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
              </article>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
