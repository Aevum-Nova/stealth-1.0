import { Outlet } from "react-router-dom";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell() {
  return (
    <div className="flex flex-col lg:h-screen lg:flex-row lg:overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
