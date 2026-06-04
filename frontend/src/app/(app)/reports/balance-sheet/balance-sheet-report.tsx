"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBalanceSheet } from "@/lib/queries/reports";

export function BalanceSheetReport() {
  const [asOf, setAsOf] = useState(() => today());
  const { data, isLoading } = useBalanceSheet(asOf);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="asOf">As of</Label>
              <Input id="asOf" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </div>
            {data ? (
              <Badge variant={data.balanced ? "success" : "danger"}>
                {data.balanced ? "A = L + E" : "UNBALANCED"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {isLoading ? <p className="text-sm text-zinc-500">Loading…</p> : null}

      {data ? (
        <>
          <Section title="Assets" rows={data.assets} total={data.totalAssets} />
          <Section title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} />
          <Section title="Equity" rows={data.equity} total={data.totalEquity} />
        </>
      ) : null}
    </div>
  );
}

function Section({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { accountId: string | null; code: string; name: string; amount: string }[];
  total: string;
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
                  No balances.
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
                  <td className="px-4 py-2 text-right font-mono">{fmt(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
            <tr>
              <td colSpan={2} className="px-4 py-3">
                Total {title.toLowerCase()}
              </td>
              <td className="px-4 py-3 text-right font-mono">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function fmt(s: string): string {
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : s;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
