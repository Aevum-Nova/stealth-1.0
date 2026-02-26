import { useNavigate } from "react-router-dom";

import ConnectorCard from "@/components/connectors/ConnectorCard";
import ConnectorCatalog from "@/components/connectors/ConnectorCatalog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useConnectorCatalog, useConnectorMutations, useConnectors } from "@/hooks/use-connectors";

export default function ConnectorsPage() {
  const navigate = useNavigate();
  const connectorsQuery = useConnectors();
  const catalogQuery = useConnectorCatalog();
  const { syncConnector } = useConnectorMutations();

  if (connectorsQuery.isLoading || catalogQuery.isLoading) {
    return <LoadingSpinner label="Loading connectors" />;
  }

  if (connectorsQuery.isError || catalogQuery.isError) {
    return <EmptyState title="Connectors unavailable" description="Could not load connector data." />;
  }

  const connectors = connectorsQuery.data?.data ?? [];
  const catalog = catalogQuery.data?.data ?? [];
  const catalogIconsByType = new Map(catalog.map((item) => [item.type, item.icon]));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl">Connectors</h2>
        <p className="text-[var(--ink-soft)]">Manage data source integrations and run sync jobs.</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg">Your Connections</h3>
        {connectors.length === 0 ? (
          <EmptyState
            title="No connectors configured"
            description="Add your first connector from the catalog below to start ingestion."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {connectors.map((connector) => (
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

      <ConnectorCatalog
        catalog={catalog}
        existing={connectors}
        onAdd={(type) => navigate(`/connectors/new/${type}`)}
      />
    </div>
  );
}
