import { BarChart3, Boxes, Database, GitMerge, Sparkles, Workflow } from "lucide-react";
import { NavLink } from "react-router-dom";

const nav = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/connectors", label: "Connectors", icon: Boxes },
  { to: "/ingest", label: "Ingest", icon: Database },
  { to: "/feature-requests", label: "Feature Requests", icon: GitMerge },
  { to: "/signals", label: "Signals", icon: Workflow },
  { to: "/synthesis", label: "Synthesis", icon: Sparkles }
];

export default function Sidebar() {
  return (
    <aside className="panel elevated overflow-hidden lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72 lg:shrink-0">
      <div className="border-b border-[var(--line)] bg-[var(--ink)] p-4 text-white sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-200">Vocalize</p>
        <h1 className="mt-1 text-xl">Connector Console</h1>
      </div>

      <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-visible">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm lg:gap-3 ${
                  isActive ? "bg-[var(--accent-soft)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[#f5efdf]"
                }`
              }
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
