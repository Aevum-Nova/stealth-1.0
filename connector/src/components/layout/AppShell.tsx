import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell() {
  const location = useLocation();
  const isFullBleed = /^\/feature-requests\/[^/]+(?:\/context)?$/.test(location.pathname);

  return (
    <div className="flex flex-col bg-[var(--surface)] lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <TopBar />
        <main className={`flex-1 min-w-0 overflow-hidden ${isFullBleed ? "" : "overflow-y-auto bg-[var(--canvas-subtle)] p-5 lg:p-8"}`}>
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
