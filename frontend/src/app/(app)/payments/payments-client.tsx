"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { usePayment, usePayments, useVoidPayment } from "@/lib/queries/payments";
import { PAYMENT_METHODS, PAYMENT_STATUSES, type Payment } from "@/lib/types";
import { PaymentForm } from "./payment-form";

export function PaymentsClient() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const params = {
    page,
    limit: 25,
    status: status || undefined,
    paymentMethod: method || undefined,
  };
  const { data, isLoading } = usePayments(params);

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
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="method">Method</Label>
              <Select
                id="method"
                value={method}
                onChange={(e) => {
                  setPage(1);
                  setMethod(e.target.value);
                }}
              >
                <option value="">All</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="ml-auto">
              <Button
                variant="secondary"
                onClick={() => {
                  setOpenId(null);
                  setShowNew((v) => !v);
                }}
              >
                {showNew ? "Cancel" : "+ Record payment"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <PaymentForm onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      {openId ? (
        <PaymentDetail id={openId} onClose={() => setOpenId(null)} />
      ) : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>Date</Th>
                <Th>Contact</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
                <Th>Reference</Th>
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
                    No payments yet.
                  </td>
                </tr>
              ) : (
                data.data.map((p) => <Row key={p.id} payment={p} onOpen={() => setOpenId(p.id)} />)
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

function Row({ payment, onOpen }: { payment: Payment; onOpen: () => void }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td>{payment.paymentDate.slice(0, 10)}</Td>
      <Td>{payment.contact?.displayName ?? "—"}</Td>
      <Td>
        <Badge variant="outline">{payment.paymentMethod.replace("_", " ")}</Badge>
      </Td>
      <Td className="text-right font-mono text-xs">{Number(payment.totalAmount).toFixed(2)}</Td>
      <Td>{payment.referenceNumber ?? "—"}</Td>
      <Td>
        <Badge variant={payment.status === "RECORDED" ? "success" : "danger"}>
          {payment.status}
        </Badge>
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Open
        </Button>
      </Td>
    </tr>
  );
}

function PaymentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: payment } = usePayment(id);
  const voidPayment = useVoidPayment();
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!payment) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">
              Payment from {payment.contact?.displayName ?? "—"}
            </div>
            <div className="text-sm text-zinc-500">
              {payment.paymentDate.slice(0, 10)} · {payment.paymentMethod.replace("_", " ")} ·{" "}
              {Number(payment.totalAmount).toFixed(2)} {payment.currency}
            </div>
          </div>
          <Badge variant={payment.status === "RECORDED" ? "success" : "danger"}>
            {payment.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.referenceNumber ? (
          <div className="text-sm">
            <span className="text-zinc-500">Reference:</span>{" "}
            <span className="font-mono">{payment.referenceNumber}</span>
          </div>
        ) : null}
        {payment.notes ? (
          <div className="text-sm">
            <span className="text-zinc-500">Notes:</span> {payment.notes}
          </div>
        ) : null}
        <div>
          <div className="mb-2 text-xs uppercase text-zinc-500">Allocations</div>
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr className="text-left">
                <th className="py-2 text-xs uppercase text-zinc-500">Invoice</th>
                <th className="py-2 text-right text-xs uppercase text-zinc-500">Allocated</th>
                <th className="py-2 text-xs uppercase text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {(payment.allocations ?? []).map((a) => (
                <tr key={a.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="py-2 font-mono text-xs">
                    {a.invoice?.invoiceNumber ?? a.invoiceId.slice(0, 8)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {Number(a.allocatedAmount).toFixed(2)}
                  </td>
                  <td className="py-2">
                    {a.isVoided ? <Badge variant="danger">voided</Badge> : <Badge variant="success">active</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FormError message={submitError ?? undefined} />
        <div className="flex justify-between">
          <div>
            {payment.status === "RECORDED" ? (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("Void this payment? Reverses allocations and posts a reversal journal entry.")) return;
                  setSubmitError(null);
                  try {
                    await voidPayment.mutateAsync(payment.id);
                    onClose();
                  } catch (err) {
                    setSubmitError(err instanceof Error ? err.message : "Failed");
                  }
                }}
                loading={voidPayment.isPending}
              >
                Void payment
              </Button>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
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
