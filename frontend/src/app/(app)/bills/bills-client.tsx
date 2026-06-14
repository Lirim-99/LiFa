"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useLocale, useT } from "@/i18n/client";
import { formatCurrency, formatDate } from "@/i18n/format";
import { useBills } from "@/lib/queries/bills";
import { BILL_STATUSES, type Bill, type BillStatus } from "@/lib/types";
import { BillEditor } from "./bill-editor";

const STATUS_VARIANT: Record<
  BillStatus,
  "default" | "success" | "warning" | "outline" | "danger" | "info"
> = {
  DRAFT: "warning",
  OPEN: "info",
  PARTIALLY_PAID: "default",
  PAID: "success",
  VOID: "danger",
};

export function BillsClient() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const params = {
    page,
    limit: 25,
    status: status || undefined,
  };
  const { data, isLoading } = useBills(params);

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
                {BILL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
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
                {showNew ? t("common.cancel") : t("bills.newBill")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {showNew ? (
        <BillEditor onDone={() => setShowNew(false)} onCancel={() => setShowNew(false)} />
      ) : null}

      {editingId ? (
        <BillEditor
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
                <Th>{t("bills.billNumber")}</Th>
                <Th>{t("bills.billDate")}</Th>
                <Th>{t("bills.vendor")}</Th>
                <Th className="text-right">{t("bills.total")}</Th>
                <Th className="text-right">{t("bills.balance")}</Th>
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
                    {t("bills.empty")}
                  </td>
                </tr>
              ) : (
                data.data.map((bill) => (
                  <Row key={bill.id} bill={bill} onOpen={() => setEditingId(bill.id)} />
                ))
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

function Row({ bill, onOpen }: { bill: Bill; onOpen: () => void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <Td className="font-mono text-xs">
        {bill.billNumber ?? <span className="text-zinc-400">—</span>}
      </Td>
      <Td>{formatDate(bill.billDate, locale)}</Td>
      <Td>{bill.contact?.displayName ?? <span className="text-zinc-400">—</span>}</Td>
      <Td className="text-right font-mono text-xs">
        {formatCurrency(Number(bill.totalAmount), locale)}
      </Td>
      <Td className="text-right font-mono text-xs">
        {formatCurrency(Number(bill.balanceDue), locale)}
      </Td>
      <Td>
        <Badge variant={STATUS_VARIANT[bill.status]}>{t(`enums.billStatus.${bill.status}`)}</Badge>
      </Td>
      <Td className="text-right">
        <Button size="sm" variant="ghost" onClick={onOpen}>
          {t("common.open")}
        </Button>
      </Td>
    </tr>
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
