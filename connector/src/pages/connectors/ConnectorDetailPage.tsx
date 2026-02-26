import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import ConnectorConfigForm from "@/components/connectors/ConnectorConfigForm";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useConnector, useConnectorCatalog, useConnectorMutations } from "@/hooks/use-connectors";
import { formatDate } from "@/lib/utils";

export default function ConnectorDetailPage() {
  const { id = "" } = useParams();
  const connectorQuery = useConnector(id);
  const catalogQuery = useConnectorCatalog();
  const { updateConnector, syncConnector } = useConnectorMutations();
  const [saved, setSaved] = useState(false);

  if (connectorQuery.isLoading || catalogQuery.isLoading) {
    return <LoadingSpinner label="Loading connector details" />;
  }

  if (connectorQuery.isError || !connectorQuery.data?.data) {
    return <EmptyState title="Connector missing" description="Could not load connector detail." />;
  }

  const connector = connectorQuery.data.data;
  const catalogItem = catalogQuery.data?.data.find((item) => item.type === connector.type);

  return (
    <div className="space-y-4">
      <Link to="/connectors" className="text-sm text-[var(--accent)]">
        ← Back to Connectors
      </Link>

      <div className="panel elevated p-4">
        <h2 className="text-3xl capitalize">{connector.type.replaceAll("_", " ")}</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">{connector.name}</p>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--ink-soft)]">Last Sync</p>
            <p>{formatDate(connector.last_sync_at)}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--ink-soft)]">Enabled</p>
            <p>{connector.enabled ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] p-3">
            <p className="text-xs text-[var(--ink-soft)]">Auto Synthesize</p>
            <p>{connector.auto_synthesize ? "Yes" : "No"}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-lg bg-[var(--ink)] px-4 py-2 text-white" onClick={() => syncConnector.mutate(connector.id)}>
            Sync Now
          </button>
          <button
            className="rounded-lg border border-[var(--line)] px-4 py-2"
            onClick={() => updateConnector.mutate({ id: connector.id, payload: { enabled: !connector.enabled } })}
          >
            {connector.enabled ? "Disable" : "Enable"}
          </button>
        </div>

        {connector.last_sync_error ? <p className="mt-3 text-sm text-red-700">{connector.last_sync_error}</p> : null}
      </div>

      {catalogItem ? (
        <div className="panel elevated p-4">
          <h3 className="mb-3 text-lg">Configuration</h3>
          <ConnectorConfigForm
            catalogItem={catalogItem}
            initialValues={connector.config}
            onSubmit={(values) => {
              setSaved(false);
              updateConnector.mutate(
                { id: connector.id, payload: { config: values } },
                {
                  onSuccess: () => setSaved(true)
                }
              );
            }}
          />
          {saved ? <p className="mt-2 text-sm text-emerald-700">Configuration saved.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
