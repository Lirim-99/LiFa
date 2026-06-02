"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold tracking-tight">LiFa</span>
        {/* Company switcher will go here in FE-2 */}
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          No company selected
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={logout}>
        Sign out
      </Button>
    </header>
  );
}
