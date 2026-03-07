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
    <article className="panel card-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ConnectorLogo
            icon={icon}
            alt={connector.type.replaceAll("_", " ")}
            className="size-8 shrink-0 object-contain"
          />
          <div>
            <h4 className="text-[15px] font-medium capitalize tracking-tight">{connector.type.replaceAll("_", " ")}</h4>
            <p className="text-[13px] text-[var(--ink-soft)]">
              {isConnected ? "Connected" : hasCredentials ? "Disabled" : "Not connected"}
              {connector.config?.repository ? ` \u00b7 ${String(connector.config.repository)}` : ""}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
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
        <p className="mt-2 text-[12px] text-[var(--ink-muted)]">Last sync {timeAgo(connector.last_sync_at)}</p>
      ) : null}
      {connector.last_sync_error ? <p className="mt-1 text-[12px] text-red-500">{connector.last_sync_error}</p> : null}

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {!hideSync ? (
          <button
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--accent-soft)] transition-colors"
            onClick={() => onSync(connector.id)}
          >
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="size-3.5" />
              Sync Now
            </span>
          </button>
        ) : null}
        <button
          className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors"
          onClick={() => onOpen(connector.id)}
        >
          <span className="inline-flex items-center gap-1.5">
            <Settings2 className="size-3.5" />
            Configure
            <ArrowRight className="size-3.5" />
          </span>
        </button>
      </div>
    </article>
  );
}
