import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">LiFa</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Accounting for Kosovo SMEs
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
