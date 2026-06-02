"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const SECTIONS = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Sales",
    items: [
      { href: "/invoices", label: "Invoices" },
      { href: "/payments", label: "Payments" },
      { href: "/contacts", label: "Contacts" },
    ],
  },
  {
    label: "Catalog & Tax",
    items: [
      { href: "/products-services", label: "Products & Services" },
      { href: "/tax-rates", label: "Tax rates" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/accounts", label: "Chart of accounts" },
      { href: "/journal-entries", label: "Journal entries" },
      { href: "/accounting-periods", label: "Periods" },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/trial-balance", label: "Trial balance" },
      { href: "/reports/general-ledger", label: "General ledger" },
      { href: "/reports/profit-and-loss", label: "P&L" },
      { href: "/reports/balance-sheet", label: "Balance sheet" },
      { href: "/reports/ar-aging", label: "AR aging" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/settings", label: "Company settings" },
      { href: "/users", label: "Users" },
      { href: "/audit-log", label: "Audit log" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white px-3 py-4 dark:border-zinc-800 dark:bg-zinc-950 sm:block">
      <nav className="space-y-6 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {section.label}
            </div>
            <ul>
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded px-2 py-1.5 text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                        active &&
                          "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
