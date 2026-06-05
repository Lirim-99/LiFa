"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CompanyFiscalConfig, FiscalCoupon } from "@/lib/types";

export const fiscalKeys = {
  all: ["fiscalization"] as const,
  config: () => ["fiscalization", "config"] as const,
  coupon: (invoiceId: string) => ["fiscalization", "coupon", invoiceId] as const,
};

export function useFiscalConfig() {
  return useQuery({
    queryKey: fiscalKeys.config(),
    queryFn: () => apiFetch<CompanyFiscalConfig>("/fiscalization/config"),
  });
}

export type FiscalConfigInput = Partial<Omit<CompanyFiscalConfig, "companyId">>;

export function useUpsertFiscalConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FiscalConfigInput) =>
      apiFetch<CompanyFiscalConfig>("/fiscalization/config", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fiscalKeys.all });
    },
  });
}

export function useInvoiceCoupon(invoiceId: string | undefined) {
  return useQuery({
    queryKey: invoiceId ? fiscalKeys.coupon(invoiceId) : ["fiscalization", "coupon", "none"],
    queryFn: () => apiFetch<FiscalCoupon | null>(`/fiscalization/invoices/${invoiceId}/coupon`),
    enabled: !!invoiceId,
  });
}

export function useFiscalizeInvoice(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<FiscalCoupon>(`/fiscalization/invoices/${invoiceId}/fiscalize`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fiscalKeys.coupon(invoiceId) });
    },
  });
}

export interface RecordManualCouponInput {
  fcuin: string;
  verificationUrl?: string;
  qrPayload?: string;
  taxBlockCode?: string;
}

export function useRecordManualCoupon(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordManualCouponInput) =>
      apiFetch<FiscalCoupon>(`/fiscalization/invoices/${invoiceId}/coupon/manual`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fiscalKeys.coupon(invoiceId) });
    },
  });
}
