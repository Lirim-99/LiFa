"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PaginatedResponse, Payment } from "@/lib/types";

export const paymentKeys = {
  all: ["payments"] as const,
  list: (params: Record<string, unknown>) => ["payments", "list", params] as const,
  detail: (id: string) => ["payments", "detail", id] as const,
};

export interface PaymentListParams {
  page?: number;
  limit?: number;
  status?: string;
  paymentMethod?: string;
  contactId?: string;
  paidFrom?: string;
  paidTo?: string;
}

function qs(params: PaymentListParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: () => apiFetch<PaginatedResponse<Payment>>(`/payments${qs(params)}`),
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: id ? paymentKeys.detail(id) : ["payments", "detail", "none"],
    queryFn: () => apiFetch<Payment>(`/payments/${id}`),
    enabled: !!id,
  });
}

export interface CreatePaymentInput {
  contactId: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paymentDate: string;
  totalAmount: number;
  referenceNumber?: string;
  notes?: string;
  allocations: { invoiceId: string; allocatedAmount: number }[];
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) =>
      apiFetch<Payment>("/payments", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.all });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useVoidPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Payment>(`/payments/${id}/void`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentKeys.all });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
