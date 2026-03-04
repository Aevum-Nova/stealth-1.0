import { ArrowRight, RefreshCw, Settings2 } from "lucide-react";

import type { Connector } from "@/types/connector";
import { timeAgo } from "@/lib/utils";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";

interface ConnectorCardProps {
  connector: Connector;
  icon: string;
  onSync: (id: string) => void;
  onOpen: (id: string) => void;
  hideSync?: boolean;
}

export default function ConnectorCard({ connector, icon, onSync, onOpen, hideSync }: ConnectorCardProps) {
  const hasCredentials = connector.credentials && Object.keys(connector.credentials).length > 0;
  const isConnected = connector.enabled && hasCredentials;

  return (
    <article className="panel elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ConnectorLogo
            icon={icon}
            alt={connector.type.replaceAll("_", " ")}
            className="size-9 shrink-0 object-contain"
          />
          <div>
            <h4 className="text-lg capitalize">{connector.type.replaceAll("_", " ")}</h4>
            <p className="text-sm text-[var(--ink-soft)]">
              {isConnected ? "Connected" : hasCredentials ? "Disabled" : "Not connected"}
              {connector.config?.repository ? ` \u00b7 ${String(connector.config.repository)}` : ""}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs ${
          isConnected
            ? "bg-emerald-100 text-emerald-800"
            : hasCredentials
              ? "bg-slate-100 text-slate-700"
              : "bg-amber-100 text-amber-800"
        }`}>
          {isConnected ? "active" : hasCredentials ? "paused" : "setup needed"}
        </span>
      </div>

      {!hideSync ? (
        <p className="mt-2 text-sm text-[var(--ink-soft)]">Last sync {timeAgo(connector.last_sync_at)}</p>
      ) : null}
      {connector.last_sync_error ? <p className="mt-1 text-xs text-red-700">{connector.last_sync_error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!hideSync ? (
          <button
            className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
            onClick={() => onSync(connector.id)}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="size-4" />
              Sync Now
            </span>
          </button>
        ) : null}
        <button
          className="rounded-lg bg-[var(--ink)] px-3 py-2 text-sm text-white"
          onClick={() => onOpen(connector.id)}
        >
          <span className="inline-flex items-center gap-2">
            <Settings2 className="size-4" />
            Configure
            <ArrowRight className="size-4" />
          </span>
        </button>
      </div>
    </article>
  );
}
