import { Bell } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useEventStream } from "@/hooks/use-event-stream";
import { initials } from "@/lib/utils";

export default function TopBar() {
  const { user } = useAuth();
  const { connected } = useEventStream();

  return (
    <header className="flex flex-col gap-3 border-b border-gray-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
        <span className={`rounded-full px-3 py-1 text-xs ${connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
          {connected ? "Live updates connected" : "Reconnecting live updates"}
        </span>
        <button className="rounded-lg border border-gray-200 p-2 text-gray-500">
          <Bell className="size-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--moss)] text-sm font-semibold text-white">
            {initials(user?.name ?? "U")}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name ?? "User"}</p>
            <p className="hidden truncate text-xs text-gray-500 sm:block">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
