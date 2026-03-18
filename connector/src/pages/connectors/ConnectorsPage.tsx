import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ConnectorCard from "@/components/connectors/ConnectorCard";
import ConnectorCatalog from "@/components/connectors/ConnectorCatalog";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
import { useConnectorCatalog, useConnectorMutations, useConnectors } from "@/hooks/use-connectors";
import { startOAuthFlow } from "@/lib/oauth";

const OUTPUT_TYPES = new Set(["github"]);

export default function ConnectorsPage() {
  const navigate = useNavigate();
  const connectorsQuery = useConnectors();
  const catalogQuery = useConnectorCatalog();
  const { pushToast } = useToast();
  const { syncConnector } = useConnectorMutations();
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  if (connectorsQuery.isLoading || catalogQuery.isLoading) {
    return <LoadingSpinner label="Loading connectors" />;
  }

  if (connectorsQuery.isError || catalogQuery.isError) {
    return <EmptyState title="Connectors unavailable" description="Could not load connector data." />;
  }

  const connectors = connectorsQuery.data?.data ?? [];
  const catalog = catalogQuery.data?.data ?? [];
  const catalogIconsByType = new Map(catalog.map((item) => [item.type, item.icon]));

  const inputConnectors = connectors.filter((c) => !OUTPUT_TYPES.has(c.type));
  const outputConnectors = connectors.filter((c) => OUTPUT_TYPES.has(c.type));
  const outputCatalog = catalog.filter((item) => (item.category ?? "input") === "output");

  const handleOutputConnect = async (item: (typeof outputCatalog)[number]) => {
    if (item.auth_method === "oauth2") {
      setConnectingType(item.type);
      setOauthError(null);
      try {
        await startOAuthFlow(item.type, item.display_name);
      } catch (err) {
        setOauthError(err instanceof Error ? err.message : "OAuth start failed");
        setConnectingType(null);
      }
    } else {
      navigate(`/connectors/new/${item.type}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Connectors</h2>
        <p className="text-[13px] text-[var(--ink-soft)]">Manage data sources, bot installs, and output integrations.</p>
      </div>

      {/* Input sources */}
      <section className="space-y-3">
        <h3 className="text-[15px] font-medium">Data Sources</h3>
        {inputConnectors.length === 0 ? (
          <EmptyState
            title="No data sources connected"
            description="Add a data source from the catalog below so you can start creating ingestion triggers."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {inputConnectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                icon={catalogIconsByType.get(connector.type) ?? connector.type}
                syncing={syncConnector.isPending && syncConnector.variables === connector.id}
                onSync={(id) => syncConnector.mutate(id, {
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
                  onError: () => pushToast("Sync failed", "error"),
                })}
                onOpen={(id) => navigate(`/connectors/${id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Output connections */}
      <section className="space-y-3">
        <h3 className="text-[15px] font-medium">Output Connections</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {outputConnectors.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              icon={catalogIconsByType.get(connector.type) ?? connector.type}
              onSync={(id) => syncConnector.mutate(id, {
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
                  onError: () => pushToast("Sync failed", "error"),
                })}
              onOpen={(id) => navigate(`/connectors/${id}`)}
              hideSync
            />
          ))}
          {outputCatalog
            .filter((item) => !outputConnectors.some((c) => c.type === item.type))
            .map((item) => (
              <article key={item.type} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ConnectorLogo
                      icon={item.icon}
                      alt={item.display_name}
                      className="size-9 shrink-0 object-contain"
                    />
                    <div>
                      <h4 className="text-[15px] font-medium capitalize">{item.display_name}</h4>
                      <p className="text-[13px] text-[var(--ink-soft)]">{item.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                    {item.auth_method}
                  </span>
                </div>
                <div className="mt-4">
                  <button
                    className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
                    disabled={item.available === false || connectingType === item.type}
                    onClick={() => void handleOutputConnect(item)}
                  >
                    {connectingType === item.type
                      ? "Redirecting..."
                      : item.available === false
                        ? "Server Setup Required"
                        : "Connect"}
                  </button>
                </div>
                {oauthError && connectingType === null ? (
                  <p className="mt-2 text-[12px] text-red-500">{oauthError}</p>
                ) : null}
                {item.available === false && item.missing_env_vars?.length ? (
                  <p className="mt-2 text-[12px] text-amber-700">
                    Missing: {item.missing_env_vars.join(", ")}
                  </p>
                ) : null}
              </article>
            ))}
        </div>
      </section>

      <ConnectorCatalog
        catalog={catalog}
        existing={connectors}
        category="input"
        title="Add a Data Source"
        onAdd={(type) => navigate(`/connectors/new/${type}`)}
      />
    </div>
  );
}
