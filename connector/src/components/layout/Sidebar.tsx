import { BarChart3, Boxes, Database, GitMerge, LogOut, PenTool, RadioTower, Workflow } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";

const mainNav = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/connectors", label: "Connectors", icon: Boxes },
  { to: "/ingest", label: "Ingest", icon: Database },
];

const analysisNav = [
  { to: "/signals", label: "Signals", icon: Workflow },
  { to: "/feature-requests", label: "Feature Requests", icon: GitMerge },
  { to: "/triggers", label: "Triggers", icon: RadioTower },
];

const buildNav = [
  { to: "/create", label: "Create", icon: PenTool },
];

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all lg:w-full ${
          isActive
            ? "bg-[var(--surface-active)] text-[var(--ink)] shadow-sm"
            : "text-[var(--ink-soft)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
        }`
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="border-b border-[var(--line)] bg-[var(--surface)] lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
          >
            V
          </div>
          <span className="text-base font-bold tracking-tight">Vector</span>
        </div>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto px-2.5 pb-2.5 lg:flex-col lg:flex-1 lg:gap-0.5 lg:overflow-visible">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <div className="hidden lg:block">
          <div className="my-3 border-t border-[var(--line-soft)]" />
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
            Analysis
          </p>
        </div>

        {analysisNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <div className="hidden lg:block">
          <div className="my-3 border-t border-[var(--line-soft)]" />
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-muted)]">
            Build
          </p>
        </div>

        {buildNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="hidden border-t border-[var(--line)] px-2.5 py-2.5 lg:block">
        <button
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
