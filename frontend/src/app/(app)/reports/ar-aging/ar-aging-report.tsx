"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency } from "@/i18n/format";
import { useArAging } from "@/lib/queries/reports";

const BUCKETS = ["current", "1-30", "31-60", "61-90", "91+"] as const;

const BUCKET_KEYS: Record<(typeof BUCKETS)[number], string> = {
  current: "reports.arAging.buckets.current",
  "1-30": "reports.arAging.buckets.b1to30",
  "31-60": "reports.arAging.buckets.b31to60",
  "61-90": "reports.arAging.buckets.b61to90",
  "91+": "reports.arAging.buckets.b91plus",
};

export function ArAgingReport() {
  const t = useT();
  const locale = useLocale();
  const [asOf, setAsOf] = useState(() => today());
  const { data, isLoading } = useArAging(asOf);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="asOf">{t("reports.common.asOf")}</Label>
              <Input id="asOf" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>{t("reports.arAging.customer")}</Th>
                {BUCKETS.map((b) => (
                  <Th key={b} className="text-right">
                    {t(BUCKET_KEYS[b])}
                  </Th>
                ))}
                <Th className="text-right">{t("reports.common.total")}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !data || data.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    {t("reports.arAging.empty")}
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr
                    key={r.contactId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <Td>{r.contactName}</Td>
                    {BUCKETS.map((b) => (
                      <Td key={b} className="text-right font-mono">
                        {formatCurrency(Number(r[b]), locale)}
                      </Td>
                    ))}
                    <Td className="text-right font-mono font-semibold">
                      {formatCurrency(Number(r.total), locale)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
            {data ? (
              <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <tr>
                  <td className="px-4 py-3">{t("reports.common.total")}</td>
                  {BUCKETS.map((b) => (
                    <td key={b} className="px-4 py-3 text-right font-mono">
                      {formatCurrency(Number(data.totals[b]), locale)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(data.totals.total), locale)}
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
