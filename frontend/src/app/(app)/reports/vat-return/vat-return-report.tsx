"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { formatCurrency } from "@/i18n/format";
import { useVatReturn, type VatRateRow } from "@/lib/queries/reports";

export function VatReturnReport() {
  const t = useT();
  const locale = useLocale();
  const [from, setFrom] = useState(() => startOfYear());
  const [to, setTo] = useState(() => today());
  const { data, isLoading } = useVatReturn(from, to);

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
          <Card>
            <CardContent className="space-y-3 p-4">
              <Row label={t("reports.vatReturn.outputVat")} amount={data.outputVat} locale={locale} />
              <Row label={t("reports.vatReturn.inputVat")} amount={data.inputVat} locale={locale} />
              <div className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <div className="text-base font-semibold">
                  {data.position === "RECEIVABLE"
                    ? t("reports.vatReturn.refund")
                    : t("reports.vatReturn.payable")}
                </div>
                <div className="font-mono text-base font-semibold">
                  {formatCurrency(Math.abs(Number(data.netVat)), locale)}
                </div>
              </div>
            </CardContent>
          </Card>
          <RateTable
            title={t("reports.vatReturn.salesByRate")}
            rows={data.salesByRate}
            locale={locale}
            netLabel={t("reports.vatReturn.net")}
            taxLabel={t("reports.vatReturn.tax")}
            empty={t("reports.common.noActivity")}
          />
          <RateTable
            title={t("reports.vatReturn.purchasesByRate")}
            rows={data.purchasesByRate}
            locale={locale}
            netLabel={t("reports.vatReturn.net")}
            taxLabel={t("reports.vatReturn.tax")}
            empty={t("reports.common.noActivity")}
          />
        </>
      ) : null}
    </div>
  );
}

function Row({ label, amount, locale }: { label: string; amount: string; locale: Locale }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(Number(amount), locale)}</span>
    </div>
  );
}

function RateTable({
  title,
  rows,
  locale,
  netLabel,
  taxLabel,
  empty,
}: {
  title: string;
  rows: VatRateRow[];
  locale: Locale;
  netLabel: string;
  taxLabel: string;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">{title}</th>
              <th className="px-4 py-2 text-right font-medium">{netLabel}</th>
              <th className="px-4 py-2 text-right font-medium">{taxLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-400">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.code} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    {row.name}{" "}
                    <span className="text-zinc-400">({Number(row.rate).toLocaleString(locale)}%)</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{formatCurrency(Number(row.net), locale)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCurrency(Number(row.tax), locale)}</td>
                </tr>
              ))
            )}
          </tbody>
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
