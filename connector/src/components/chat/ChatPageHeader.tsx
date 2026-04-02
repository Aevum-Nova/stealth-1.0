import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

import ThemeToggle from "@/components/layout/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { initials } from "@/lib/utils";

export function ChatPageHeader() {
  const { user, logout } = useAuth();
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

  const displayName = user?.name?.trim() || "User";

  return (
    <div className="flex items-center gap-3 md:gap-4">
      <ThemeToggle compact />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex max-w-[200px] items-center gap-2.5 rounded-lg py-1 pl-0.5 pr-1 transition-colors hover:bg-[var(--surface-subtle)]"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
            style={{ backgroundColor: "#7c3aed" }}
          >
            {initials(user?.name ?? "U")}
          </span>
          <span className="truncate text-[14px] font-medium text-[var(--ink)]">{displayName}</span>
        </button>

        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
            role="menu"
          >
            <div className="border-b border-[var(--line)] px-3 py-2.5">
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                Hi, {user?.name?.split(" ")[0] ?? "User"}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">{user?.email ?? ""}</p>
            </div>
            <div className="px-1.5 py-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
