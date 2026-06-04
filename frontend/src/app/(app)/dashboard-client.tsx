"use client";

import {
  ArrowRightIcon,
  BanknotesIcon,
  ClockIcon,
  DocumentTextIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInvoices } from "@/lib/queries/invoices";
import { useArAging, useProfitAndLoss } from "@/lib/queries/reports";
import type { Invoice, InvoiceStatus } from "@/lib/types";

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "success" | "warning" | "info" | "danger"
> = {
  DRAFT: "warning",
  ISSUED: "info",
  PARTIALLY_PAID: "default",
  PAID: "success",
  VOID: "danger",
};

export function DashboardClient({
  firstName,
  companyName,
}: {
  firstName: string;
  companyName: string;
}) {
  const fromOfMonth = firstDayOfMonth();
  const today = todayIso();

  const { data: pnl } = useProfitAndLoss(fromOfMonth, today);
  const { data: aging } = useArAging(today);
  const { data: monthInvoices } = useInvoices({
    issuedFrom: fromOfMonth,
    issuedTo: today,
    limit: 1,
  });
  const { data: drafts } = useInvoices({ status: "DRAFT", limit: 1 });
  const { data: recent } = useInvoices({ limit: 5 });

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Active company:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">{companyName}</span>
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Outstanding AR"
          value={aging ? fmtMoney(aging.totals.total) : "—"}
          tone="warning"
          icon={<ClockIcon className="h-5 w-5" />}
          hint={aging ? `${aging.rows.length} customers` : ""}
        />
        <MetricCard
          label="Revenue this month"
          value={pnl ? fmtMoney(pnl.totalRevenue) : "—"}
          tone="success"
          icon={<BanknotesIcon className="h-5 w-5" />}
          hint={pnl ? `Net income ${fmtMoney(pnl.netIncome)}` : ""}
        />
        <MetricCard
          label="Invoices this month"
          value={monthInvoices ? String(monthInvoices.total) : "—"}
          tone="info"
          icon={<DocumentTextIcon className="h-5 w-5" />}
          hint=""
        />
        <MetricCard
          label="Pending drafts"
          value={drafts ? String(drafts.total) : "—"}
          tone="default"
          icon={<DocumentTextIcon className="h-5 w-5" />}
          hint={drafts && drafts.total > 0 ? "Finish or delete" : ""}
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/invoices">
            <Button>
              <PlusIcon className="h-4 w-4" />
              New invoice
            </Button>
          </Link>
          <Link href="/payments">
            <Button variant="accent">
              <PlusIcon className="h-4 w-4" />
              Record payment
            </Button>
          </Link>
          <Link href="/journal-entries">
            <Button variant="secondary">
              <PlusIcon className="h-4 w-4" />
              Journal entry
            </Button>
          </Link>
          <Link href="/contacts">
            <Button variant="secondary">
              <PlusIcon className="h-4 w-4" />
              New contact
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent invoices</CardTitle>
            <Link
              href="/invoices"
              className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            >
              View all <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!recent || recent.data.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Create your first invoice to start tracking receivables."
              cta={{ href: "/invoices", label: "Create invoice" }}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.data.map((inv: Invoice) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {inv.contact?.displayName ?? "—"}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        {inv.invoiceNumber ?? "draft"} · {inv.issueDate.slice(0, 10)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-right font-mono text-sm">
                      {fmtMoney(inv.totalAmount)}
                    </span>
                    <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: "success" | "warning" | "danger" | "info" | "default";
}) {
  const ring: Record<typeof tone, string> = {
    success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    warning: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
    info: "bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
    default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start gap-3 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ring[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</div>
          {hint ? (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <DocumentTextIcon className="h-6 w-6" />
      </div>
      <div className="mt-3 text-sm font-medium">{title}</div>
      <div className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        {description}
      </div>
      {cta ? (
        <Link href={cta.href} className="mt-4">
          <Button size="sm">{cta.label}</Button>
        </Link>
      ) : null}
    </div>
  );
}

function fmtMoney(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(n);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
