import { Bell } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useEventStream } from "@/hooks/use-event-stream";
import { initials } from "@/lib/utils";

export default function TopBar() {
  const { user } = useAuth();
  const { connected } = useEventStream();

  return (
    <header className="flex items-center justify-end gap-3 border-b border-[var(--line)] bg-white px-4 py-2.5">
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
          connected
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {connected ? "Live" : "Reconnecting..."}
      </span>

      <button className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink-soft)]">
        <Bell className="size-4" />
      </button>

      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] font-medium text-white">
          {initials(user?.name ?? "U")}
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-[13px] font-medium leading-tight">{user?.name ?? "User"}</p>
        </div>
      </div>
    </header>
  );
}
