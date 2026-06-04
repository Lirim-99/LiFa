"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useArAging } from "@/lib/queries/reports";

const BUCKETS = ["current", "1-30", "31-60", "61-90", "91+"] as const;

export function ArAgingReport() {
  const [asOf, setAsOf] = useState(() => today());
  const { data, isLoading } = useArAging(asOf);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="asOf">As of</Label>
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
                <Th>Customer</Th>
                {BUCKETS.map((b) => (
                  <Th key={b} className="text-right">
                    {b === "current" ? "Current" : `${b} days`}
                  </Th>
                ))}
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : !data || data.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    No outstanding receivables.
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
                        {fmt(r[b])}
                      </Td>
                    ))}
                    <Td className="text-right font-mono font-semibold">{fmt(r.total)}</Td>
                  </tr>
                ))
              )}
            </tbody>
            {data ? (
              <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  {BUCKETS.map((b) => (
                    <td key={b} className="px-4 py-3 text-right font-mono">
                      {fmt(data.totals[b])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono">{fmt(data.totals.total)}</td>
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

function fmt(s: string): string {
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(2) : s;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
