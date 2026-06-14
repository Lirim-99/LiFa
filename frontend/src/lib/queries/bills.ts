"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Bill, PaginatedResponse } from "@/lib/types";

export const billKeys = {
  all: ["bills"] as const,
  list: (params: BillListParams) => ["bills", "list", params] as const,
  detail: (id: string) => ["bills", "detail", id] as const,
};

export interface BillListParams {
  page?: number;
  limit?: number;
  status?: string;
  contactId?: string;
  billedFrom?: string;
  billedTo?: string;
}

function qs(params: BillListParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useBills(params: BillListParams) {
  return useQuery({
    queryKey: billKeys.list(params),
    queryFn: () => apiFetch<PaginatedResponse<Bill>>(`/bills${qs(params)}`),
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: id ? billKeys.detail(id) : ["bills", "detail", "none"],
    queryFn: () => apiFetch<Bill>(`/bills/${id}`),
    enabled: !!id,
  });
}

export interface BillLineInput {
  productServiceId?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: number;
  taxRateId?: string;
  expenseAccountId?: string;
}

export interface CreateBillInput {
  contactId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  lines: BillLineInput[];
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillInput) =>
      apiFetch<Bill>("/bills", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}

export function useUpdateBill(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateBillInput>) =>
      apiFetch<Bill>(`/bills/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billKeys.all });
      void qc.invalidateQueries({ queryKey: billKeys.detail(id) });
    },
  });
}

export function usePostBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Bill>(`/bills/${id}/post`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}

export function useVoidBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Bill>(`/bills/${id}/void`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}

export function useDeleteBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/bills/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: billKeys.all }),
  });
}
