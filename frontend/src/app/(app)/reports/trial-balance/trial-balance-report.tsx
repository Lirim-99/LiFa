"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTrialBalance } from "@/lib/queries/reports";

export function TrialBalanceReport() {
  const [from, setFrom] = useState(() => startOfYear());
  const [to, setTo] = useState(() => today());
  const { data, isLoading } = useTrialBalance(from, to);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {data ? (
              <Badge variant={data.balanced ? "success" : "danger"}>
                {data.balanced ? "Balanced" : "UNBALANCED"}
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
                <Th>Code</Th>
                <Th>Account</Th>
                <Th>Type</Th>
                <Th className="text-right">Debit</Th>
                <Th className="text-right">Credit</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : !data || data.lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No posted activity in this range.
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
                    <Td className="text-right font-mono">{fmt(l.debit)}</Td>
                    <Td className="text-right font-mono">{fmt(l.credit)}</Td>
                  </tr>
                ))
              )}
            </tbody>
            {data ? (
              <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(data.totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(data.totalCredit)}</td>
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
function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}
