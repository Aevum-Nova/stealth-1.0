import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ConnectorConfigForm from "@/components/connectors/ConnectorConfigForm";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import SlackChannelPicker from "@/components/connectors/SlackChannelPicker";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
import { useConnector, useConnectorCatalog, useConnectorMutations } from "@/hooks/use-connectors";
import { useTriggers } from "@/hooks/use-triggers";
import { formatDate } from "@/lib/utils";

export default function ConnectorDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const connectorQuery = useConnector(id);
  const catalogQuery = useConnectorCatalog();
  const { updateConnector, syncConnector, deleteConnector } = useConnectorMutations();
  const triggersQuery = useTriggers();

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (connectorQuery.isLoading || catalogQuery.isLoading) {
    return <LoadingSpinner fill label="Loading connector details" />;
  }

  if (connectorQuery.isError || !connectorQuery.data?.data) {
    return <EmptyState title="Connector missing" description="Could not load connector detail." />;
  }

  const connector = connectorQuery.data.data;
  const catalogItem = catalogQuery.data?.data.find((item) => item.type === connector.type);

  const handleDisconnect = () => {
    deleteConnector.mutate(connector.id, {
      onSuccess: () => {
        pushToast("Connector disconnected", "success");
        navigate("/connectors");
      },
      onError: () => pushToast("Failed to disconnect connector", "error")
    });
  };

  // ─── Data Source Layout ───────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Link to="/connectors" className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Connectors
      </Link>

      {/* Header */}
      <div className="panel p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            {catalogItem ? (
              <ConnectorLogo icon={catalogItem.icon} alt={catalogItem.display_name} className="h-11 w-11" />
            ) : null}
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight capitalize">{connector.type.replaceAll("_", " ")}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  connector.enabled
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-[var(--accent-soft)] text-[var(--ink-muted)] ring-1 ring-[var(--line)]"
                }`}>
                  {connector.enabled ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{catalogItem?.description ?? connector.name}</p>
            </div>
          </div>
        </div>

        {/* Status row */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">Last Sync</p>
            <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{connector.last_sync_at ? formatDate(connector.last_sync_at) : "Never"}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">Auto Synthesize</p>
            <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{connector.auto_synthesize ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">Status</p>
            <p className={`mt-0.5 text-[13px] font-medium ${connector.enabled ? "text-emerald-600" : "text-[var(--ink-muted)]"}`}>
              {connector.enabled ? "Connected" : "Disabled"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2.5 border-t border-[var(--line)] pt-4">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:opacity-50"
            disabled={syncConnector.isPending}
            onClick={() =>
              syncConnector.mutate(connector.id, {
                onSuccess: (data) => {
                  const d = data.data as Record<string, unknown>;
                  if (d.error) {
                    pushToast(`Sync error: ${d.error}`, "error");
                  } else if ((d.new_signals as number) > 0) {
                    pushToast(`Sync complete — ${d.new_signals} new signals`, "success");
                  } else {
                    pushToast("Sync complete — no new data found", "success");
                  }
                },
                onError: () => pushToast("Sync failed", "error")
              })
            }
          >
            {syncConnector.isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                Sync Now
              </>
            )}
          </button>

          <button
            className="rounded-lg border border-[var(--line)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-50"
            disabled={updateConnector.isPending}
            onClick={() =>
              updateConnector.mutate(
                { id: connector.id, payload: { enabled: !connector.enabled } },
                {
                  onSuccess: () => pushToast(connector.enabled ? "Connector disabled" : "Connector enabled", "success"),
                  onError: () => pushToast("Failed to update connector", "error")
                }
              )
            }
          >
            {updateConnector.isPending ? "Updating..." : connector.enabled ? "Disable" : "Enable"}
          </button>

          <button
            className="rounded-lg border border-rose-200 px-4 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            onClick={() => setConfirmDisconnect(true)}
          >
            Disconnect
          </button>
        </div>

        {connector.last_sync_error ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
            {connector.last_sync_error}
          </div>
        ) : null}
      </div>

      {/* Config form */}
      {catalogItem ? (
        <div className="panel p-5">
          <div className="mb-5">
            <h3 className="text-[14px] font-semibold text-[var(--ink)]">Configuration</h3>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">Customize how this connector ingests data</p>
          </div>
          {connector.type === "slack" ? (
            <SlackChannelPicker
              connectorId={connector.id}
              initialChannelIds={(connector.config?.channel_ids as string[]) ?? []}
              saving={updateConnector.isPending}
              onSave={(channelIds, channelNames) => {
                updateConnector.mutate(
                  { id: connector.id, payload: { config: { ...connector.config, channel_ids: channelIds, channel_names: channelNames } } },
                  {
                    onSuccess: () => pushToast("Channels updated", "success"),
                    onError: () => pushToast("Failed to update channels", "error")
                  }
                );
              }}
            />
          ) : (
            <ConnectorConfigForm
              catalogItem={catalogItem}
              initialValues={connector.config}
              onSubmit={(values) => {
                updateConnector.mutate(
                  { id: connector.id, payload: { config: values } },
                  {
                    onSuccess: () => pushToast("Configuration saved", "success"),
                    onError: () => pushToast("Failed to save configuration", "error")
                  }
                );
              }}
            />
          )}
        </div>
      ) : null}

      {connector.type === "slack" && (connector.config?.channel_ids as string[] | undefined)?.length ? (() => {
        const hasTrigger = (triggersQuery.data?.data ?? []).some((t) => t.connector?.type === connector.type);
        return (
          <div className="panel inline-flex items-center gap-3 px-5 py-3.5">
            <p className="text-[13px] text-[var(--ink-soft)]">
              {hasTrigger
                ? "You have triggers set up for this connector."
                : "Next step — set up a trigger to process incoming messages automatically."}
            </p>
            <button
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2d6a6a] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#245757]"
              onClick={() => navigate("/triggers")}
            >
              {hasTrigger ? "View Triggers" : "Create Trigger"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
          </div>
        );
      })() : null}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect connector?"
        description="This will remove the connector and its configuration. This action cannot be undone."
        confirmLabel="Disconnect"
        onConfirm={handleDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
