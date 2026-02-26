import { BarChart3, Boxes, Database, GitMerge, LogOut, Sparkles, Workflow } from "lucide-react";
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
  { to: "/synthesis", label: "Synthesis", icon: Sparkles },
];

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm lg:gap-3 ${
          isActive ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
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
    <aside className="border-b border-gray-200 bg-white lg:border-b-0 lg:border-r lg:w-56 lg:shrink-0 lg:flex lg:flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold text-gray-900">Vocalize</p>
        <p className="text-xs text-gray-400">Connector Console</p>
      </div>

      {/* Navigation */}
      <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:flex-1 lg:space-y-1 lg:overflow-visible">
        {/* Main section */}
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        {/* Divider + Analysis section */}
        <div className="hidden lg:block">
          <div className="my-3 border-t border-gray-200" />
          <p className="mb-2 px-3 text-[10px] uppercase tracking-widest text-gray-400">Analysis</p>
        </div>
        {analysisNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Footer with logout */}
      <div className="hidden border-t border-gray-200 p-3 lg:block">
        <button
          onClick={() => void logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          <LogOut className="size-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
