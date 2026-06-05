
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency } from "@/i18n/format";
import { useTrialBalance } from "@/lib/queries/reports";

export function TrialBalanceReport() {
  const t = useT();
  const locale = useLocale();
  const [from, setFrom] = useState(() => startOfYear());
  const [to, setTo] = useState(() => today());
  const { data, isLoading } = useTrialBalance(from, to);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">{t("common.from")}</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">{t("common.to")}</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {data ? (
              <Badge variant={data.balanced ? "success" : "danger"}>
                {data.balanced ? t("reports.trialBalance.balanced") : t("reports.trialBalance.unbalanced")}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>{t("common.code")}</Th>
                <Th>{t("reports.common.account")}</Th>
                <Th>{t("common.type")}</Th>
                <Th className="text-right">{t("reports.common.debit")}</Th>
                <Th className="text-right">{t("reports.common.credit")}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !data || data.lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    {t("reports.trialBalance.empty")}
                  </td>
                </tr>
              ) : (
                data.lines.map((l) => (
                  <tr
                    key={l.accountId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <Td className="font-mono text-xs">{l.code}</Td>
                    <Td>{l.name}</Td>
                    <Td className="text-xs text-zinc-500">{l.accountType}</Td>
                    <Td className="text-right font-mono">{formatCurrency(Number(l.debit), locale)}</Td>
                    <Td className="text-right font-mono">{formatCurrency(Number(l.credit), locale)}</Td>
                  </tr>
                ))
              )}
            </tbody>
            {data ? (
              <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right">
                    {t("reports.common.totals")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(data.totalDebit), locale)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(data.totalCredit), locale)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
