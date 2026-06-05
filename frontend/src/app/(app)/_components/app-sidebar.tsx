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
import { useT } from "@/i18n/client";
import { cn } from "@/lib/cn";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type NavItem = { href: string; labelKey: string; icon: IconType };

const SECTIONS: { labelKey: string; items: NavItem[] }[] = [
  {
    labelKey: "nav.sections.overview",
    items: [{ href: "/", labelKey: "nav.items.dashboard", icon: HomeIcon }],
  },
  {
    labelKey: "nav.sections.sales",
    items: [
      { href: "/invoices", labelKey: "nav.items.invoices", icon: DocumentTextIcon },
      { href: "/payments", labelKey: "nav.items.payments", icon: BanknotesIcon },
      { href: "/contacts", labelKey: "nav.items.contacts", icon: UserGroupIcon },
    ],
  },
  {
    labelKey: "nav.sections.catalogTax",
    items: [
      { href: "/products-services", labelKey: "nav.items.products", icon: ShoppingBagIcon },
      { href: "/tax-rates", labelKey: "nav.items.taxRates", icon: ReceiptPercentIcon },
    ],
  },
  {
    labelKey: "nav.sections.accounting",
    items: [
      { href: "/accounts", labelKey: "nav.items.accounts", icon: BookOpenIcon },
      {
        href: "/journal-entries",
        labelKey: "nav.items.journalEntries",
        icon: ClipboardDocumentCheckIcon,
      },
      { href: "/accounting-periods", labelKey: "nav.items.periods", icon: CalendarDaysIcon },
    ],
  },
  {
    labelKey: "nav.sections.reports",
    items: [
      { href: "/reports/trial-balance", labelKey: "nav.items.trialBalance", icon: Squares2X2Icon },
      { href: "/reports/general-ledger", labelKey: "nav.items.generalLedger", icon: BookOpenIcon },
      { href: "/reports/profit-and-loss", labelKey: "nav.items.profitAndLoss", icon: ChartBarIcon },
      { href: "/reports/balance-sheet", labelKey: "nav.items.balanceSheet", icon: ChartBarIcon },
      { href: "/reports/ar-aging", labelKey: "nav.items.arAging", icon: ClipboardDocumentListIcon },
    ],
  },
  {
    labelKey: "nav.sections.admin",
    items: [
      { href: "/settings", labelKey: "nav.items.settings", icon: Cog6ToothIcon },
      { href: "/users", labelKey: "nav.items.users", icon: UsersIcon },
      { href: "/audit-log", labelKey: "nav.items.auditLog", icon: ClipboardDocumentListIcon },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useT();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-800 dark:bg-slate-900 sm:block">
      <nav className="space-y-5 text-sm">
        {SECTIONS.map((section) => (
          <div key={section.labelKey}>
            <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t(section.labelKey)}
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
                      <span className="truncate">{t(item.labelKey)}</span>
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
