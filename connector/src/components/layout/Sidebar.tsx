import {
  BarChart3,
  Boxes,
  Database,
  GitMerge,
  PenTool,
  RadioTower,
  Workflow,
} from "lucide-react";
import { NavLink } from "react-router-dom";

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

const buildNav = [{ to: "/create", label: "Create", icon: PenTool }];

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
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
  return (
    <aside className="app-sidebar border-b border-[var(--line)] lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span className="sidebar-logo-mark" aria-hidden />
          <span className="text-[18px] font-bold tracking-[-0.04em]">Vector</span>
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

    </aside>
  );
}
