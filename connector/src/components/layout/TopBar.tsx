import { Bell } from "lucide-react";

import ThemeToggle from "@/components/layout/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { useEventStream } from "@/hooks/use-event-stream";
import { initials } from "@/lib/utils";

export default function TopBar() {
  const { user } = useAuth();
  const { connected } = useEventStream();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2">
      {connected ? (
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-600">Live</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1">
          <span className="size-1.5 rounded-full bg-amber-500" />
          <span className="text-[11px] font-medium text-amber-600">Reconnecting...</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <ThemeToggle compact />

        <button className="rounded-lg p-2 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink-soft)]">
          <Bell className="size-4" />
        </button>

        <div className="ml-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-subtle)]">
          <div
            className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
          >
            {initials(user?.name ?? "U")}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-[13px] font-medium leading-tight">{user?.name ?? "User"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
