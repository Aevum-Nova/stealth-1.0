import type { Connector, ConnectorCatalogItem } from "@/types/connector";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";

interface ConnectorCatalogProps {
  catalog: ConnectorCatalogItem[];
  existing: Connector[];
  onAdd: (type: string) => void;
}

export default function ConnectorCatalog({ catalog, existing, onAdd }: ConnectorCatalogProps) {
  const existingTypes = new Set(existing.map((item) => item.type));

  return (
    <section className="panel elevated p-4">
      <h3 className="mb-3 text-lg">Add a Connection</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => {
          const alreadyAdded = existingTypes.has(item.type);
          const unavailable = item.available === false;
          const disabled = unavailable && !alreadyAdded;
          return (
            <article key={item.type} className="rounded-lg border border-[var(--line)] bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ConnectorLogo
                    icon={item.icon}
                    alt={item.display_name}
                    className="size-8 shrink-0 object-contain"
                  />
                  <div>
                    <h4 className="capitalize">{item.display_name}</h4>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">{item.description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500">
                  {item.auth_method}
                </span>
              </div>
              {unavailable ? (
                <p className="mt-2 text-xs text-amber-800">
                  Server setup required
                  {item.missing_env_vars?.length ? ` (${item.missing_env_vars.join(", ")})` : ""}
                </p>
              ) : null}
              <button
                disabled={disabled}
                className={`mt-3 w-full rounded-lg px-3 py-2 text-sm ${
                  disabled
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : alreadyAdded
                      ? "bg-emerald-100 text-emerald-900"
                      : "bg-[var(--ink)] text-white"
                }`}
                onClick={() => {
                  if (!disabled) {
                    onAdd(item.type);
                  }
                }}
              >
                {alreadyAdded ? "Added (Configure)" : unavailable ? "Server Setup Required" : "Add"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
