"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAccounts } from "@/lib/queries/accounts";
import { useGeneralLedger } from "@/lib/queries/reports";

export function GeneralLedgerReport() {
  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(() => startOfYear());
  const [to, setTo] = useState(() => today());
  const { data, isLoading } = useGeneralLedger(accountId, from, to);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <Label htmlFor="accountId">Account</Label>
              <Select
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">— Pick an account —</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {!accountId ? (
        <p className="text-sm text-zinc-500">Pick an account to see its ledger.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Entry</Th>
                  <Th>Source</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Debit</Th>
                  <Th className="text-right">Credit</Th>
                  <Th className="text-right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {data ? (
                  <tr className="bg-zinc-50 italic text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    <td colSpan={6} className="px-4 py-2 text-right">
                      Opening balance
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(data.openingBalance)}</td>
                  </tr>
                ) : null}
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                      Loading…
                    </td>
                  </tr>
                ) : !data || data.lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                      No activity in this range.
                    </td>
                  </tr>
                ) : (
                  data.lines.map((l, idx) => (
                    <tr
                      key={`${l.entryId}-${idx}`}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <Td>{l.entryDate}</Td>
                      <Td className="font-mono text-xs">{l.entryNumber ?? "—"}</Td>
                      <Td className="text-xs text-zinc-500">{l.sourceDocumentType ?? "—"}</Td>
                      <Td>{l.description ?? "—"}</Td>
                      <Td className="text-right font-mono">{fmt(l.debit)}</Td>
                      <Td className="text-right font-mono">{fmt(l.credit)}</Td>
                      <Td className="text-right font-mono">{fmt(l.runningBalance)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
              {data ? (
                <tfoot className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-right">
                      Closing balance
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(data.closingBalance)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </CardContent>
        </Card>
      )}
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
