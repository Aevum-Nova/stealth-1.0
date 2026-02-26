import { Outlet } from "react-router-dom";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppShell() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-3 sm:p-4 lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 space-y-4">
        <TopBar />
        <Outlet />
      </main>
    </div>
  );
}
