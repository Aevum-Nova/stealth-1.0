import { useEffect, useRef, useState } from "react";
import { Building2, LogOut, User } from "lucide-react";

import ThemeToggle from "@/components/layout/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { useEventStream } from "@/hooks/use-event-stream";
import { initials } from "@/lib/utils";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { connected } = useEventStream();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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

        {/* Profile avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <div
              className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
            >
              {initials(user?.name ?? "U")}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[13px] font-medium leading-tight">{user?.name ?? "User"}</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg">
              {/* User info */}
              <div className="border-b border-[var(--line)] px-3 py-2.5">
                <p className="text-[13px] font-semibold text-[var(--ink)]">
                  Hi, {user?.name?.split(" ")[0] ?? "User"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                  {user?.email ?? ""}
                </p>
              </div>

              {/* Menu items */}
              {/* <div className="border-b border-[var(--line)] px-1.5 py-1.5">
                <p className="mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
                  Manage
                </p>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                >
                  <User className="size-3.5" />
                  Profile
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                >
                  <Building2 className="size-3.5" />
                  Organization
                </button>
              </div> */}

              {/* Sign out */}
              <div className="px-1.5 py-1.5">
                <button
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
