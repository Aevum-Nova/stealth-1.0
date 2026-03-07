import { Outlet } from "react-router-dom";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell() {
  return (
    <div className="flex flex-col lg:h-screen lg:flex-row lg:overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-[var(--canvas-subtle)] p-5 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
