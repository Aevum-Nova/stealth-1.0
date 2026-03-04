import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ConnectorCard from "@/components/connectors/ConnectorCard";
import ConnectorCatalog from "@/components/connectors/ConnectorCatalog";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useConnectorCatalog, useConnectorMutations, useConnectors } from "@/hooks/use-connectors";
import { startOAuthFlow } from "@/lib/oauth";

const OUTPUT_TYPES = new Set(["github"]);

export default function ConnectorsPage() {
  const navigate = useNavigate();
  const connectorsQuery = useConnectors();
  const catalogQuery = useConnectorCatalog();
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
        <h2 className="text-3xl">Connectors</h2>
        <p className="text-[var(--ink-soft)]">Manage data sources and output integrations.</p>
      </div>

      {/* Input sources */}
      <section className="space-y-3">
        <h3 className="text-lg">Data Sources</h3>
        {inputConnectors.length === 0 ? (
          <EmptyState
            title="No data sources connected"
            description="Add a data source from the catalog below to start ingesting signals."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {inputConnectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                icon={catalogIconsByType.get(connector.type) ?? connector.type}
                onSync={(id) => syncConnector.mutate(id)}
                onOpen={(id) => navigate(`/connectors/${id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Output connections */}
      <section className="space-y-3">
        <h3 className="text-lg">Output Connections</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {outputConnectors.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              icon={catalogIconsByType.get(connector.type) ?? connector.type}
              onSync={(id) => syncConnector.mutate(id)}
              onOpen={(id) => navigate(`/connectors/${id}`)}
              hideSync
            />
          ))}
          {outputCatalog
            .filter((item) => !outputConnectors.some((c) => c.type === item.type))
            .map((item) => (
              <article key={item.type} className="panel elevated p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ConnectorLogo
                      icon={item.icon}
                      alt={item.display_name}
                      className="size-9 shrink-0 object-contain"
                    />
                    <div>
                      <h4 className="text-lg capitalize">{item.display_name}</h4>
                      <p className="text-sm text-[var(--ink-soft)]">{item.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500">
                    {item.auth_method}
                  </span>
                </div>
                <div className="mt-4">
                  <button
                    className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-white"
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
                  <p className="mt-2 text-xs text-red-700">{oauthError}</p>
                ) : null}
                {item.available === false && item.missing_env_vars?.length ? (
                  <p className="mt-2 text-xs text-amber-800">
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
