import { Bell, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useEventStream } from "@/hooks/use-event-stream";
import { initials } from "@/lib/utils";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { connected } = useEventStream();

  return (
    <header className="panel elevated flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <p className="text-xs text-[var(--ink-soft)] sm:text-sm">Ingestion & Synthesis Platform</p>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
        <span className={`rounded-full px-3 py-1 text-xs ${connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {connected ? "Live updates connected" : "Reconnecting live updates"}
        </span>
        <button className="rounded-lg border border-[var(--line)] p-2 text-[var(--ink-soft)]">
          <Bell className="size-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--moss)] text-sm font-semibold text-white">
            {initials(user?.name ?? "U")}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name ?? "User"}</p>
            <p className="hidden truncate text-xs text-[var(--ink-soft)] sm:block">{user?.email}</p>
          </div>
        </div>
        <button
          className="rounded-lg border border-[var(--line)] px-2 py-2 text-sm text-[var(--ink-soft)] sm:px-3"
          aria-label="Logout"
          onClick={() => void logout()}
        >
          <span className="inline-flex items-center gap-2">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Logout</span>
          </span>
        </button>
      </div>
    </header>
  );
}
