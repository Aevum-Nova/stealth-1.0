import { ArrowRight, RefreshCw, Settings2 } from "lucide-react";

import type { Connector } from "@/types/connector";
import { timeAgo } from "@/lib/utils";
import ConnectorLogo from "@/components/connectors/ConnectorLogo";

interface ConnectorCardProps {
  connector: Connector;
  icon: string;
  syncing?: boolean;
  onSync: (id: string) => void;
  onOpen: (id: string) => void;
  hideSync?: boolean;
}

export default function ConnectorCard({ connector, icon, syncing, onSync, onOpen, hideSync }: ConnectorCardProps) {
  const hasCredentials = connector.credentials && Object.keys(connector.credentials).length > 0;
  const isConnected = connector.enabled && hasCredentials;

  return (
    <article className="panel card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <ConnectorLogo
            icon={icon}
            alt={connector.type.replaceAll("_", " ")}
            className="size-10 shrink-0 object-contain"
          />
          <div>
            <h4 className="text-[17px] font-medium capitalize tracking-tight">{connector.type.replaceAll("_", " ")}</h4>
            <p className="text-[14px] text-[var(--ink-soft)]">
              {isConnected ? "Connected" : hasCredentials ? "Disabled" : "Not connected"}
              {connector.config?.repository ? ` \u00b7 ${String(connector.config.repository)}` : ""}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
          isConnected
            ? "bg-emerald-50 text-emerald-700"
            : hasCredentials
              ? "bg-[var(--accent-soft)] text-[var(--ink-soft)]"
              : "bg-amber-50 text-amber-700"
        }`}>
          {isConnected ? "active" : hasCredentials ? "paused" : "setup needed"}
        </span>
      </div>

      {!hideSync ? (
        <p className="mt-3 text-[13px] text-[var(--ink-muted)]">Last sync {timeAgo(connector.last_sync_at)}</p>
      ) : null}
      {connector.last_sync_error ? <p className="mt-1 text-[13px] text-red-500">{connector.last_sync_error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!hideSync ? (
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary)] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[var(--action-primary-hover)] disabled:opacity-50"
            disabled={syncing}
            onClick={() => onSync(connector.id)}
          >
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        ) : null}
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2 text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--accent-soft)]"
          onClick={() => onOpen(connector.id)}
        >
          <Settings2 className="size-4" />
          Configure
          <ArrowRight className="size-4" />
        </button>
      </div>
    </article>
  );
}
