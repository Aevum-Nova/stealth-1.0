import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ConnectorConfigForm from "@/components/connectors/ConnectorConfigForm";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import GitHubRepoPicker from "@/components/connectors/GitHubRepoPicker";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
import { useConnector, useConnectorCatalog, useConnectorMutations } from "@/hooks/use-connectors";
import { formatDate } from "@/lib/utils";

export default function ConnectorDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const connectorQuery = useConnector(id);
  const catalogQuery = useConnectorCatalog();
  const { updateConnector, syncConnector, deleteConnector } = useConnectorMutations();

  const [changingRepo, setChangingRepo] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (connectorQuery.isLoading || catalogQuery.isLoading) {
    return <LoadingSpinner label="Loading connector details" />;
  }

  if (connectorQuery.isError || !connectorQuery.data?.data) {
    return <EmptyState title="Connector missing" description="Could not load connector detail." />;
  }

  const connector = connectorQuery.data.data;
  const catalogItem = catalogQuery.data?.data.find((item) => item.type === connector.type);
  const isGitHub = connector.type === "github";

  const handleDisconnect = () => {
    deleteConnector.mutate(connector.id, {
      onSuccess: () => {
        pushToast("Connector disconnected", "success");
        navigate("/connectors");
      },
      onError: () => pushToast("Failed to disconnect connector", "error")
    });
  };

  if (isGitHub) {
    return (
      <div className="space-y-4">
        <Link to="/connectors" className="text-[13px] text-[var(--accent)]">&larr; Back to Connectors</Link>

        {/* Header */}
        <div className="panel p-4">
          <div className="flex items-center gap-3">
            {catalogItem ? (
              <ConnectorLogo icon={catalogItem.icon} alt={catalogItem.display_name} className="h-10 w-10" />
            ) : null}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">GitHub</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  connector.enabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[var(--accent-soft)] text-[var(--ink-muted)]"
                }`}>
                  {connector.enabled ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-[13px] text-[var(--ink-soft)]">{connector.name}</p>
            </div>
          </div>
        </div>

        {/* Connected repo */}
        {!changingRepo && connector.config?.repository ? (
          <div className="panel p-4">
            <h3 className="mb-3 text-[15px] font-medium">Connected Repository</h3>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-[var(--ink-soft)]" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9z" />
              </svg>
              <a
                href={`https://github.com/${connector.config.repository}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--accent)] hover:underline"
              >
                {String(connector.config.repository)}
              </a>
              <span className="text-[13px] text-[var(--ink-soft)]">
                / branch: <span className="font-medium text-[var(--ink)]">{String(connector.config.default_branch ?? "main")}</span>
              </span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
                onClick={() => setChangingRepo(true)}
              >
                Change Repository
              </button>
              <button
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                onClick={() => setConfirmDisconnect(true)}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : null}

        {/* Repo picker (inline) — show when changing or when no repo configured */}
        {changingRepo || !connector.config?.repository ? (
          <div className="panel p-4">
            <h3 className="mb-3 text-[15px] font-medium">Select Repository</h3>
            <GitHubRepoPicker
              connectorId={connector.id}
              initialRepo={connector.config?.repository as string | undefined}
              initialBranch={connector.config?.default_branch as string | undefined}
              saving={updateConnector.isPending}
              onSelect={(repo, branch) => {
                updateConnector.mutate(
                  {
                    id: connector.id,
                    payload: {
                      name: `GitHub - ${repo}`,
                      config: { repository: repo, default_branch: branch }
                    }
                  },
                  {
                    onSuccess: () => {
                      pushToast("Repository updated", "success");
                      setChangingRepo(false);
                    },
                    onError: () => pushToast("Failed to update repository", "error")
                  }
                );
              }}
              onCancel={connector.config?.repository ? () => setChangingRepo(false) : undefined}
            />
            {!connector.config?.repository ? (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <button
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {connector.last_sync_error ? (
          <p className="text-[13px] text-red-500">{connector.last_sync_error}</p>
        ) : null}

        <ConfirmDialog
          open={confirmDisconnect}
          title="Disconnect GitHub?"
          description="This will remove the connector and its configuration. This action cannot be undone."
          confirmLabel="Disconnect"
          onConfirm={handleDisconnect}
          onCancel={() => setConfirmDisconnect(false)}
        />
      </div>
    );
  }

  // ─── Data Source Layout ───────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Link to="/connectors" className="text-[13px] text-[var(--accent)]">&larr; Back to Connectors</Link>

      {/* Header */}
      <div className="panel p-4">
        <div className="flex items-center gap-3">
          {catalogItem ? (
            <ConnectorLogo icon={catalogItem.icon} alt={catalogItem.display_name} className="h-10 w-10" />
          ) : null}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight capitalize">{connector.type.replaceAll("_", " ")}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                connector.enabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[var(--accent-soft)] text-[var(--ink-muted)]"
              }`}>
                {connector.enabled ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-[13px] text-[var(--ink-soft)]">{connector.name}</p>
          </div>
        </div>

        {/* Stat bar */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span className="text-[var(--ink-soft)]">
            Last Sync: <span className="text-[var(--ink)]">{formatDate(connector.last_sync_at)}</span>
          </span>
          <span className="text-[var(--ink-soft)]">
            Auto Synthesize: <span className="text-[var(--ink)]">{connector.auto_synthesize ? "On" : "Off"}</span>
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
            disabled={syncConnector.isPending}
            onClick={() =>
              syncConnector.mutate(connector.id, {
                onSuccess: (data) => pushToast(`Sync complete — ${data.data.new_signals} new signals`, "success"),
                onError: () => pushToast("Sync failed", "error")
              })
            }
          >
            {syncConnector.isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Syncing...
              </span>
            ) : (
              "Sync Now"
            )}
          </button>

          <button
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors disabled:opacity-50"
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
            className="rounded-lg border border-rose-200 px-3 py-1.5 text-[13px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            onClick={() => setConfirmDisconnect(true)}
          >
            Disconnect
          </button>
        </div>

        {connector.last_sync_error ? (
          <p className="mt-3 text-[13px] text-red-500">{connector.last_sync_error}</p>
        ) : null}
      </div>

      {/* Config form */}
      {catalogItem ? (
        <div className="panel p-4">
          <h3 className="mb-3 text-[15px] font-medium">Configuration</h3>
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
        </div>
      ) : null}

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
