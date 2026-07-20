"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CompanyFiscalConfig, FiscalCoupon } from "@/lib/types";

export const fiscalKeys = {
  all: ["fiscalization"] as const,
  config: () => ["fiscalization", "config"] as const,
  coupon: (invoiceId: string) => ["fiscalization", "coupon", invoiceId] as const,
  creditNoteCoupon: (cnId: string) => ["fiscalization", "cn-coupon", cnId] as const,
  coupons: (params?: FiscalCouponListParams) => ["fiscalization", "coupons", params] as const,
};

export interface FiscalCouponListParams {
  page?: number;
  limit?: number;
  status?: string;
  couponType?: string;
}

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

// ===================== Credit Note Coupons =====================

export function useCreditNoteCoupon(creditNoteId: string | undefined) {
  return useQuery({
    queryKey: creditNoteId
      ? fiscalKeys.creditNoteCoupon(creditNoteId)
      : ["fiscalization", "cn-coupon", "none"],
    queryFn: () =>
      apiFetch<FiscalCoupon | null>(`/fiscalization/credit-notes/${creditNoteId}/coupon`),
    enabled: !!creditNoteId,
  });
}

export function useRecordManualCreditNoteCoupon(creditNoteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordManualCouponInput) =>
      apiFetch<FiscalCoupon>(`/fiscalization/credit-notes/${creditNoteId}/coupon/manual`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fiscalKeys.creditNoteCoupon(creditNoteId) });
    },
  });
}

// ===================== Coupons List (Report) =====================

export interface FiscalCouponWithDoc extends FiscalCoupon {
  invoice?: { id: string; invoiceNumber: string | null; status: string } | null;
  creditNote?: { id: string; creditNoteNumber: string | null; status: string } | null;
}

interface PaginatedCoupons {
  data: FiscalCouponWithDoc[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useFiscalCoupons(params?: FiscalCouponListParams) {
  return useQuery({
    queryKey: fiscalKeys.coupons(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.couponType) qs.set("couponType", params.couponType);
      return apiFetch<PaginatedCoupons>(`/fiscalization/coupons?${qs.toString()}`);
    },
  });
}
