import { useState } from "react";
import { Check, ArrowRight, RefreshCw } from "lucide-react";

import type { Connector, ConnectorCatalogItem } from "@/types/connector";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";
import { startOAuthFlow } from "@/lib/oauth";

interface ConnectorCatalogProps {
  catalog: ConnectorCatalogItem[];
  existing: Connector[];
  category: "input" | "output";
  title: string;
  onAdd: (type: string) => void;
  onConfigure: (id: string) => void;
  onSync: (id: string) => void;
  syncingId?: string;
}

export default function ConnectorCatalog({ catalog, existing, category, title, onAdd, onConfigure, onSync, syncingId }: ConnectorCatalogProps) {
  const existingByType = new Map(existing.map((item) => [item.type, item]));
  const existingTypes = new Set(existingByType.keys());
  const filtered = catalog.filter((item) => (item.category ?? "input") === category);
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (filtered.length === 0) return null;

  const handleAdd = async (item: ConnectorCatalogItem) => {
    const alreadyAdded = existingTypes.has(item.type);
    if (item.auth_method === "oauth2" && !alreadyAdded) {
      setLoadingType(item.type);
      setError(null);
      try {
        await startOAuthFlow(item.type, item.display_name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "OAuth start failed");
        setLoadingType(null);
      }
    } else {
      onAdd(item.type);
    }
  };

  return (
    <section>
      <h3 className="text-[17px] font-medium">{title}</h3>
      {error ? <p className="text-[14px] text-red-700">{error}</p> : null}
      <div className="mt-4 inline-grid grid-cols-1 gap-3 md:grid-cols-[28rem_28rem]">
        {filtered.map((item) => {
          const alreadyAdded = existingTypes.has(item.type);
          const connector = existingByType.get(item.type);
          const unavailable = item.available === false;
          const disabled = (unavailable && !alreadyAdded) || loadingType === item.type;
          const isSyncing = connector ? syncingId === connector.id : false;
          return (
            <article key={item.type} className="rounded-lg border border-[var(--line)] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <ConnectorLogo
                    icon={item.icon}
                    alt={item.display_name}
                    className="size-10 shrink-0 object-contain"
                  />
                  <div>
                    <h4 className="text-[16px] font-medium capitalize">{item.display_name}</h4>
                    <p className="mt-1 text-[13px] text-[var(--ink-soft)]">{item.description}</p>
                  </div>
                </div>
              </div>
              {unavailable && !alreadyAdded ? (
                <p className="mt-3 text-[13px] text-amber-800">
                  Server setup required
                  {item.missing_env_vars?.length ? ` (${item.missing_env_vars.join(", ")})` : ""}
                </p>
              ) : null}
              {alreadyAdded && connector ? (
                <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                    <Check className="size-4" />
                    Connected
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] disabled:opacity-50"
                      disabled={isSyncing}
                      onClick={() => onSync(connector.id)}
                    >
                      <RefreshCw className={`size-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Syncing..." : "Sync"}
                    </button>
                    <button
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
                      onClick={() => onConfigure(connector.id)}
                    >
                      Configure
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={disabled}
                  className={`mt-4 w-full rounded-lg px-4 py-2.5 text-[14px] font-medium transition-colors ${
                    disabled
                      ? "cursor-not-allowed bg-[var(--accent-soft)] text-[var(--ink-muted)]"
                      : "bg-[var(--ink)] text-white hover:bg-[var(--accent-hover)]"
                  }`}
                  onClick={() => void handleAdd(item)}
                >
                  {loadingType === item.type
                    ? "Redirecting..."
                    : unavailable
                      ? "Server Setup Required"
                      : "Add"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
