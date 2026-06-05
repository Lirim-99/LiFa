"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import {
  useFiscalConfig,
  useFiscalizeInvoice,
  useInvoiceCoupon,
  useRecordManualCoupon,
} from "@/lib/queries/fiscalization";
import type { FiscalCouponStatus } from "@/lib/types";

const STATUS_VARIANT: Record<FiscalCouponStatus, "default" | "success" | "warning" | "danger"> = {
  PENDING: "warning",
  FISCALIZED: "success",
  FAILED: "danger",
  VOIDED: "default",
  EXEMPT: "default",
};

/** Fiscal coupon status + actions for an issued invoice. Renders nothing while
 *  fiscalization is disabled for the company. */
export function FiscalCouponPanel({ invoiceId }: { invoiceId: string }) {
  const t = useT();
  const { data: config } = useFiscalConfig();
  const { data: coupon } = useInvoiceCoupon(invoiceId);
  const fiscalize = useFiscalizeInvoice(invoiceId);
  const record = useRecordManualCoupon(invoiceId);
  const [fcuin, setFcuin] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!config?.enabled) return null;

  const runFiscalize = async () => {
    setError(null);
    try {
      await fiscalize.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fiscal.fiscalizeFailed"));
    }
  };

  const submitManual = async () => {
    if (!fcuin.trim()) return;
    setError(null);
    try {
      await record.mutateAsync({ fcuin: fcuin.trim() });
      setShowManual(false);
      setFcuin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fiscal.fiscalizeFailed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("fiscal.couponTitle")}</CardTitle>
          {coupon ? (
            <Badge variant={STATUS_VARIANT[coupon.status]}>
              {t(`enums.fiscalCouponStatus.${coupon.status}`)}
            </Badge>
          ) : (
            <span className="text-sm text-slate-500">{t("fiscal.noCoupon")}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {coupon?.fcuin ? (
          <div className="text-sm">
            <span className="text-slate-500">{t("fiscal.fcuin")}: </span>
            <span className="font-mono">{coupon.fcuin}</span>
            {coupon.verificationUrl ? (
              <a
                href={coupon.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 text-sky-600 hover:underline dark:text-sky-400"
              >
                {t("fiscal.verify")}
              </a>
            ) : null}
          </div>
        ) : null}

        {coupon?.status !== "FISCALIZED" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={runFiscalize} loading={fiscalize.isPending}>
              {t("fiscal.fiscalize")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowManual((v) => !v)}
            >
              {t("fiscal.recordManual")}
            </Button>
          </div>
        ) : null}

        {showManual ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="fcuin">{t("fiscal.fcuin")}</Label>
              <Input id="fcuin" value={fcuin} onChange={(e) => setFcuin(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={submitManual} loading={record.isPending}>
              {t("common.save")}
            </Button>
          </div>
        ) : null}

        <FormError message={error ?? coupon?.errorMessage ?? undefined} />
      </CardContent>
    </Card>
  );
}
