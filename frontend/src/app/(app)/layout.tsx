import type { ReactNode } from "react";
import { AppHeader } from "./_components/app-header";
import { AppSidebar } from "./_components/app-sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppHeader />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
      </div>
    </div>
  );
}
