"use client";

import {
  BanknotesIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  HomeIcon,
  ReceiptPercentIcon,
  ShoppingBagIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type NavItem = { href: string; label: string; icon: IconType };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: HomeIcon }],
  },
  {
    label: "Sales",
    items: [
      { href: "/invoices", label: "Invoices", icon: DocumentTextIcon },
      { href: "/payments", label: "Payments", icon: BanknotesIcon },
      { href: "/contacts", label: "Contacts", icon: UserGroupIcon },
    ],
  },
  {
    label: "Catalog & Tax",
    items: [
      { href: "/products-services", label: "Products & services", icon: ShoppingBagIcon },
      { href: "/tax-rates", label: "Tax rates", icon: ReceiptPercentIcon },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/accounts", label: "Chart of accounts", icon: BookOpenIcon },
      { href: "/journal-entries", label: "Journal entries", icon: ClipboardDocumentCheckIcon },
      { href: "/accounting-periods", label: "Periods", icon: CalendarDaysIcon },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/trial-balance", label: "Trial balance", icon: Squares2X2Icon },
      { href: "/reports/general-ledger", label: "General ledger", icon: BookOpenIcon },
      { href: "/reports/profit-and-loss", label: "P&L", icon: ChartBarIcon },
      { href: "/reports/balance-sheet", label: "Balance sheet", icon: ChartBarIcon },
      { href: "/reports/ar-aging", label: "AR aging", icon: ClipboardDocumentListIcon },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/settings", label: "Company settings", icon: Cog6ToothIcon },
      { href: "/users", label: "Users", icon: UsersIcon },
      { href: "/audit-log", label: "Audit log", icon: ClipboardDocumentListIcon },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 sm:block">
      <nav className="space-y-5 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {section.label}
            </div>
            <ul>
              {section.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
                        active &&
                          "bg-sky-50 font-medium text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                          active && "text-sky-600 dark:text-sky-400",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
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
