"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" onClick={logout}>
      Sign out
    </Button>
  );
}
