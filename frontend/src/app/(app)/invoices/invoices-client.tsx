"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useInvoices } from "@/lib/queries/invoices";
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from "@/lib/types";
import { InvoiceEditor } from "./invoice-editor";

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "success" | "warning" | "outline" | "danger"> = {
  DRAFT: "warning",
  ISSUED: "default",
  PARTIALLY_PAID: "outline",
  PAID: "success",
  VOID: "danger",
};

export function InvoicesClient() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const params = {
    page,
    limit: 25,
    status: status || undefined,
  };
  const { data, isLoading } = useInvoices(params);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="">All</option>
                {INVOICE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="ml-auto">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setShowNew((v) => !v);
                }}
              >
                {showNew ? "Cancel" : "+ New invoice"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <InvoiceEditor onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      {editingId ? (
        <InvoiceEditor
          id={editingId}
          onDone={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>Number</Th>
                <Th>Issue date</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Balance</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    No invoices.
                  </td>
                </tr>
              ) : (
                data.data.map((inv) => <Row key={inv.id} inv={inv} onOpen={() => setEditingId(inv.id)} />)
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} total
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ inv, onOpen }: { inv: Invoice; onOpen: () => void }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td className="font-mono text-xs">{inv.invoiceNumber ?? <span className="text-zinc-400">draft</span>}</Td>
      <Td>{inv.issueDate.slice(0, 10)}</Td>
      <Td>{inv.contact?.displayName ?? <span className="text-zinc-400">—</span>}</Td>
      <Td className="text-right font-mono text-xs">{Number(inv.totalAmount).toFixed(2)}</Td>
      <Td className="text-right font-mono text-xs">{Number(inv.balanceDue).toFixed(2)}</Td>
      <Td>
        <Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge>
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Open
        </Button>
      </Td>
    </tr>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
