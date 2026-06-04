"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Invoice, PaginatedResponse } from "@/lib/types";

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (params: Record<string, unknown>) => ["invoices", "list", params] as const,
  detail: (id: string) => ["invoices", "detail", id] as const,
};

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  status?: string;
  contactId?: string;
  issuedFrom?: string;
  issuedTo?: string;
}

function qs(params: InvoiceListParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useInvoices(params: InvoiceListParams) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: () => apiFetch<PaginatedResponse<Invoice>>(`/invoices${qs(params)}`),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: id ? invoiceKeys.detail(id) : ["invoices", "detail", "none"],
    queryFn: () => apiFetch<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export interface InvoiceLineInput {
  productServiceId?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: number;
  taxRateId?: string;
  incomeAccountId?: string;
}

export interface CreateInvoiceInput {
  contactId: string;
  issueDate: string;
  dueDate: string;
  currency?: string;
  notes?: string;
  lines: InvoiceLineInput[];
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      apiFetch<Invoice>("/invoices", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateInvoiceInput>) =>
      apiFetch<Invoice>(`/invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invoiceKeys.all });
      void qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Invoice>(`/invoices/${id}/issue`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Invoice>(`/invoices/${id}/void`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: invoiceKeys.all }),
  });
}
