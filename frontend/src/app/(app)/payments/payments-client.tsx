"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency, formatDate } from "@/i18n/format";
import { usePayment, usePayments, useVoidPayment } from "@/lib/queries/payments";
import { PAYMENT_METHODS, PAYMENT_STATUSES, type Payment } from "@/lib/types";
import { PaymentForm } from "./payment-form";

export function PaymentsClient() {
  const t = useT();
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
              <Label htmlFor="status">{t("common.status")}</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="">{t("common.all")}</option>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="method">{t("payments.method")}</Label>
              <Select
                id="method"
                value={method}
                onChange={(e) => {
                  setPage(1);
                  setMethod(e.target.value);
                }}
              >
                <option value="">{t("common.all")}</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.label)}
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
                {showNew ? t("common.cancel") : t("payments.recordPaymentAction")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <PaymentForm onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      {openId ? <PaymentDetail id={openId} onClose={() => setOpenId(null)} /> : null}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr className="text-left">
                <Th>{t("payments.date")}</Th>
                <Th>{t("payments.contact")}</Th>
                <Th>{t("payments.method")}</Th>
                <Th className="text-right">{t("payments.amount")}</Th>
                <Th>{t("payments.reference")}</Th>
                <Th>{t("common.status")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !data || data.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    {t("payments.empty")}
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
            {t("common.pagination", {
              page: data.page,
              totalPages: data.totalPages,
              total: data.total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t("common.previous")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ payment, onOpen }: { payment: Payment; onOpen: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td>{formatDate(payment.paymentDate.slice(0, 10), locale)}</Td>
      <Td>{payment.contact?.displayName ?? "—"}</Td>
      <Td>
        <Badge variant="outline">{t(`enums.paymentMethod.${payment.paymentMethod}`)}</Badge>
      </Td>
      <Td className="text-right font-mono text-xs">
        {formatCurrency(Number(payment.totalAmount), locale, payment.currency)}
      </Td>
      <Td>{payment.referenceNumber ?? "—"}</Td>
      <Td>
        <Badge variant={payment.status === "RECORDED" ? "success" : "danger"}>
          {t(`enums.paymentStatus.${payment.status}`)}
        </Badge>
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          {t("common.open")}
        </Button>
      </Td>
    </tr>
  );
}

function PaymentDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
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
              {t("payments.paymentFrom", { name: payment.contact?.displayName ?? "—" })}
            </div>
            <div className="text-sm text-zinc-500">
              {formatDate(payment.paymentDate.slice(0, 10), locale)} ·{" "}
              {t(`enums.paymentMethod.${payment.paymentMethod}`)} ·{" "}
              {formatCurrency(Number(payment.totalAmount), locale, payment.currency)}
            </div>
          </div>
          <Badge variant={payment.status === "RECORDED" ? "success" : "danger"}>
            {t(`enums.paymentStatus.${payment.status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {payment.referenceNumber ? (
          <div className="text-sm">
            <span className="text-zinc-500">{t("payments.referenceLabel")}</span>{" "}
            <span className="font-mono">{payment.referenceNumber}</span>
          </div>
        ) : null}
        {payment.notes ? (
          <div className="text-sm">
            <span className="text-zinc-500">{t("payments.notesLabel")}</span> {payment.notes}
          </div>
        ) : null}
        <div>
          <div className="mb-2 text-xs uppercase text-zinc-500">{t("payments.allocations")}</div>
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800">
              <tr className="text-left">
                <th className="py-2 text-xs uppercase text-zinc-500">{t("payments.invoice")}</th>
                <th className="py-2 text-right text-xs uppercase text-zinc-500">
                  {t("payments.allocated")}
                </th>
                <th className="py-2 text-xs uppercase text-zinc-500">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(payment.allocations ?? []).map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-2 font-mono text-xs">
                    {a.invoice?.invoiceNumber ?? a.invoiceId.slice(0, 8)}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(Number(a.allocatedAmount), locale, payment.currency)}
                  </td>
                  <td className="py-2">
                    {a.isVoided ? (
                      <Badge variant="danger">{t("payments.voided")}</Badge>
                    ) : (
                      <Badge variant="success">{t("payments.active")}</Badge>
                    )}
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
                  if (!confirm(t("payments.voidConfirm"))) return;
                  setSubmitError(null);
                  try {
                    await voidPayment.mutateAsync(payment.id);
                    onClose();
                  } catch (err) {
                    setSubmitError(err instanceof Error ? err.message : t("payments.voidFailed"));
                  }
                }}
                loading={voidPayment.isPending}
              >
                {t("payments.voidPayment")}
              </Button>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose}>
            {t("payments.close")}
          </Button>
        </div>
      </CardContent>
    </Card>
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
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
