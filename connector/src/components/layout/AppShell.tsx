import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell() {
  const location = useLocation();
  const isFullBleed =
    location.pathname === "/feature-requests" ||
    /^\/feature-requests\/[^/]+(?:\/context)?$/.test(location.pathname) ||
    location.pathname === "/create";

  return (
    <div className="flex flex-col bg-[var(--canvas)] lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <TopBar />
        <main
          className={
            isFullBleed
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]"
              : "min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--canvas-subtle)] p-5 lg:p-8"
          }
        >
          {isFullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
