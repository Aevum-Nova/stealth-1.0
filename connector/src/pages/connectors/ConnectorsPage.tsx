import { useNavigate } from "react-router-dom";

import ConnectorCatalog from "@/components/connectors/ConnectorCatalog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useToast } from "@/components/shared/Toast";
import { useConnectorCatalog, useConnectorMutations, useConnectors } from "@/hooks/use-connectors";
const ALLOWED_TYPES = new Set(["slack"]);

export default function ConnectorsPage() {
  const navigate = useNavigate();
  const connectorsQuery = useConnectors();
  const catalogQuery = useConnectorCatalog();
  const { pushToast } = useToast();
  const { syncConnector } = useConnectorMutations();

  if (connectorsQuery.isLoading || catalogQuery.isLoading) {
    return <LoadingSpinner fill label="Loading connectors" />;
  }

  if (connectorsQuery.isError || catalogQuery.isError) {
    return <EmptyState title="Connectors unavailable" description="Could not load connector data." />;
  }

  const connectors = (connectorsQuery.data?.data ?? []).filter((c) => ALLOWED_TYPES.has(c.type));
  const catalog = (catalogQuery.data?.data ?? []).filter((item) => ALLOWED_TYPES.has(item.type));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Connectors</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Manage data sources, bot installs, and output integrations.</p>
      </div>

      <ConnectorCatalog
        catalog={catalog}
        existing={connectors}
        category="input"
        title="Data Sources"
        onAdd={(type) => navigate(`/connectors/new/${type}`)}
        onConfigure={(id) => navigate(`/connectors/${id}`)}
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
        syncingId={syncConnector.isPending ? (syncConnector.variables as string) : undefined}
      />
    </div>
  );
}
