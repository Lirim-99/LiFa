"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useT } from "@/i18n/client";
import { useFiscalCoupons, type FiscalCouponWithDoc } from "@/lib/queries/fiscalization";
import type { FiscalCouponStatus } from "@/lib/types";

const STATUS_VARIANT: Record<FiscalCouponStatus, "default" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  FISCALIZED: "success",
  FAILED: "danger",
  VOIDED: "default",
  EXEMPT: "default",
};

export function FiscalCouponsClient() {
  const t = useT();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const { data, isLoading } = useFiscalCoupons({
    page,
    limit: 20,
    status: statusFilter || undefined,
    couponType: typeFilter || undefined,
  });

  const coupons = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("fiscal.couponsTitle")}</h1>
          <p className="text-sm text-zinc-500">{t("fiscal.couponsDescription")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("fiscal.allStatuses")}</option>
              <option value="PENDING">{t("enums.fiscalCouponStatus.PENDING")}</option>
              <option value="FISCALIZED">{t("enums.fiscalCouponStatus.FISCALIZED")}</option>
              <option value="FAILED">{t("enums.fiscalCouponStatus.FAILED")}</option>
              <option value="VOIDED">{t("enums.fiscalCouponStatus.VOIDED")}</option>
            </Select>
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">{t("fiscal.allTypes")}</option>
              <option value="SALE">{t("fiscal.typeSale")}</option>
              <option value="RETURN">{t("fiscal.typeReturn")}</option>
            </Select>
            {meta && (
              <span className="ml-auto text-sm text-zinc-500">
                {meta.total} {t("fiscal.total")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-zinc-500">{t("common.loading")}</p>
          ) : coupons.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">{t("fiscal.noCoupons")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-zinc-500">
                    <th className="pb-2 pr-3">{t("fiscal.document")}</th>
                    <th className="pb-2 pr-3">{t("fiscal.couponTypeLabel")}</th>
                    <th className="pb-2 pr-3">{t("fiscal.statusLabel")}</th>
                    <th className="pb-2 pr-3">{t("fiscal.fcuin")}</th>
                    <th className="pb-2 pr-3">{t("fiscal.amount")}</th>
                    <th className="pb-2">{t("fiscal.fiscalizedAtLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <CouponRow key={c.id} coupon={c} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← {t("common.prev")}
              </Button>
              <span className="text-sm text-zinc-600">
                {page} / {meta.totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.totalPages}
              >
                {t("common.next")} →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CouponRow({ coupon, t }: { coupon: FiscalCouponWithDoc; t: ReturnType<typeof useT> }) {
  const docLabel = coupon.invoice
    ? coupon.invoice.invoiceNumber ?? "—"
    : coupon.creditNote
      ? coupon.creditNote.creditNoteNumber ?? "—"
      : "—";

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 font-mono text-xs">{docLabel}</td>
      <td className="py-2 pr-3">
        <Badge variant={coupon.couponType === "SALE" ? "default" : "warning"}>
          {coupon.couponType === "SALE" ? t("fiscal.typeSale") : t("fiscal.typeReturn")}
        </Badge>
      </td>
      <td className="py-2 pr-3">
        <Badge variant={STATUS_VARIANT[coupon.status]}>{t(`enums.fiscalCouponStatus.${coupon.status}`)}</Badge>
      </td>
      <td className="py-2 pr-3 font-mono text-xs">{coupon.fcuin ?? "—"}</td>
      <td className="py-2 pr-3">{coupon.currency} {Number(coupon.totalAmount).toFixed(2)}</td>
      <td className="py-2 text-xs text-zinc-500">
        {coupon.fiscalizedAt ? new Date(coupon.fiscalizedAt).toLocaleDateString() : "—"}
      </td>
    </tr>
  );
}
