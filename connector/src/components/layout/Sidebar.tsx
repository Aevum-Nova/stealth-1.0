import { BarChart3, Boxes, Database, GitMerge, LogOut, RadioTower, Workflow } from "lucide-react";
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

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
          isActive
            ? "bg-[var(--accent-soft)] text-[var(--ink)]"
            : "text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
        }`
      }
    >
      <Icon className="size-[15px]" />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="border-b border-[var(--line)] bg-white lg:border-b-0 lg:border-r lg:w-52 lg:shrink-0 lg:flex lg:flex-col">
      <div className="px-4 py-3.5">
        <p className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Vocalize</p>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto px-2.5 pb-2.5 lg:block lg:flex-1 lg:space-y-0.5 lg:overflow-visible">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <div className="hidden lg:block">
          <div className="my-2.5 border-t border-[var(--line-soft)]" />
          <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            Analysis
          </p>
        </div>

        {analysisNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="hidden border-t border-[var(--line)] px-2.5 py-2.5 lg:block">
        <button
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
        >
          <LogOut className="size-[15px]" />
          Logout
        </button>
      </div>
    </aside>
  );
}
