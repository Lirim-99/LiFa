"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency } from "@/i18n/format";
import { useProfitAndLoss } from "@/lib/queries/reports";

export function ProfitAndLossReport() {
  const t = useT();
  const locale = useLocale();
  const [from, setFrom] = useState(() => startOfYear());
  const [to, setTo] = useState(() => today());
  const { data, isLoading } = useProfitAndLoss(from, to);

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
          </div>
        </CardHeader>
      </Card>

      {isLoading ? <p className="text-sm text-zinc-500">{t("common.loading")}</p> : null}

      {data ? (
        <>
          <Section
            title={t("reports.profitAndLoss.revenue")}
            totalLabel={t("reports.profitAndLoss.totalRevenue")}
            emptyLabel={t("reports.common.noActivity")}
            rows={data.revenue}
            total={data.totalRevenue}
            locale={locale}
          />
          <Section
            title={t("reports.profitAndLoss.expenses")}
            totalLabel={t("reports.profitAndLoss.totalExpenses")}
            emptyLabel={t("reports.common.noActivity")}
            rows={data.expenses}
            total={data.totalExpenses}
            locale={locale}
          />
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="text-base font-semibold">{t("reports.profitAndLoss.netIncome")}</div>
              <div
                className={`text-base font-semibold font-mono ${
                  Number(data.netIncome) >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {formatCurrency(Number(data.netIncome), locale)}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Section({
  title,
  totalLabel,
  emptyLabel,
  rows,
  total,
  locale,
}: {
  title: string;
  totalLabel: string;
  emptyLabel: string;
  rows: { accountId: string; code: string; name: string; amount: string }[];
  total: string;
  locale: import("@/i18n/config").Locale;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-center text-zinc-500">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.accountId}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="w-20 px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCurrency(Number(r.amount), locale)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
            <tr>
              <td colSpan={2} className="px-4 py-3">
                {totalLabel}
              </td>
              <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(total), locale)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
