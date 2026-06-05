"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency } from "@/i18n/format";
import { useBalanceSheet } from "@/lib/queries/reports";

export function BalanceSheetReport() {
  const t = useT();
  const locale = useLocale();
  const [asOf, setAsOf] = useState(() => today());
  const { data, isLoading } = useBalanceSheet(asOf);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="asOf">{t("reports.common.asOf")}</Label>
              <Input id="asOf" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
            {data ? (
              <Badge variant={data.balanced ? "success" : "danger"}>
                {data.balanced
                  ? t("reports.balanceSheet.balanced")
                  : t("reports.balanceSheet.unbalanced")}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {isLoading ? <p className="text-sm text-zinc-500">{t("common.loading")}</p> : null}

      {data ? (
        <>
          <Section
            title={t("reports.balanceSheet.assets")}
            totalLabel={t("reports.balanceSheet.totalAssets")}
            emptyLabel={t("reports.balanceSheet.noBalances")}
            rows={data.assets}
            total={data.totalAssets}
            locale={locale}
          />
          <Section
            title={t("reports.balanceSheet.liabilities")}
            totalLabel={t("reports.balanceSheet.totalLiabilities")}
            emptyLabel={t("reports.balanceSheet.noBalances")}
            rows={data.liabilities}
            total={data.totalLiabilities}
            locale={locale}
          />
          <Section
            title={t("reports.balanceSheet.equity")}
            totalLabel={t("reports.balanceSheet.totalEquity")}
            emptyLabel={t("reports.balanceSheet.noBalances")}
            rows={data.equity}
            total={data.totalEquity}
            locale={locale}
          />
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
  rows: { accountId: string | null; code: string; name: string; amount: string }[];
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
              rows.map((r, idx) => (
                <tr
                  key={r.accountId ?? `${title}-${idx}`}
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
