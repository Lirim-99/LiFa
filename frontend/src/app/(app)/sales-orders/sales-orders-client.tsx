"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/client";
import {
  useCancelOrder,
  useConfirmOrder,
  useSalesOrders,
  type SalesOrder,
} from "@/lib/queries/quotes";

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "danger" | "outline" | "info"> = {
  DRAFT: "outline",
  CONFIRMED: "info",
  PARTIALLY_INVOICED: "warning",
  INVOICED: "success",
  CANCELLED: "danger",
};

export function SalesOrdersClient() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data, isLoading } = useSalesOrders({ page, limit: 25, status: statusFilter || undefined });
  const confirmOrder = useConfirmOrder();
  const cancelOrder = useCancelOrder();

  const orders = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("salesOrders.title")}</h1>
          <p className="text-sm text-zinc-500">{t("salesOrders.description")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <select
              className="rounded-md border bg-white px-3 py-1.5 text-sm dark:bg-zinc-900"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("salesOrders.allStatuses")}</option>
              <option value="DRAFT">{t("salesOrders.statusDraft")}</option>
              <option value="CONFIRMED">{t("salesOrders.statusConfirmed")}</option>
              <option value="PARTIALLY_INVOICED">{t("salesOrders.statusPartiallyInvoiced")}</option>
              <option value="INVOICED">{t("salesOrders.statusInvoiced")}</option>
              <option value="CANCELLED">{t("salesOrders.statusCancelled")}</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-zinc-500">{t("common.loading")}</p>}
          {!isLoading && orders.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">{t("salesOrders.noOrders")}</p>
          )}
          {orders.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 pr-3">{t("salesOrders.number")}</th>
                  <th className="pb-2 pr-3">{t("salesOrders.customer")}</th>
                  <th className="pb-2 pr-3">{t("salesOrders.date")}</th>
                  <th className="pb-2 pr-3">{t("salesOrders.delivery")}</th>
                  <th className="pb-2 pr-3">{t("salesOrders.amount")}</th>
                  <th className="pb-2 pr-3">{t("salesOrders.status")}</th>
                  <th className="pb-2">{t("salesOrders.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    t={t}
                    onConfirm={() => confirmOrder.mutate(o.id)}
                    onCancel={() => cancelOrder.mutate(o.id)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {meta.total} {t("salesOrders.total")}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  &laquo;
                </Button>
                <Button size="sm" variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
                  &raquo;
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderRow({
  order,
  t,
  onConfirm,
  onCancel,
}: {
  order: SalesOrder;
  t: ReturnType<typeof useT>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 font-mono text-xs">{order.orderNumber ?? "—"}</td>
      <td className="py-2 pr-3">{order.contact.displayName}</td>
      <td className="py-2 pr-3 text-xs">{new Date(order.orderDate).toLocaleDateString()}</td>
      <td className="py-2 pr-3 text-xs">
        {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}
      </td>
      <td className="py-2 pr-3">{order.currency} {Number(order.totalAmount).toFixed(2)}</td>
      <td className="py-2 pr-3">
        <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>{order.status}</Badge>
      </td>
      <td className="py-2">
        <div className="flex gap-1">
          {order.status === "DRAFT" && (
            <>
              <Button size="sm" onClick={onConfirm}>{t("salesOrders.confirm")}</Button>
              <Button size="sm" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
            </>
          )}
          {(order.status === "CONFIRMED" || order.status === "PARTIALLY_INVOICED") && (
            <Button size="sm" variant="secondary" onClick={onCancel}>{t("common.cancel")}</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
