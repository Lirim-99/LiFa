"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CreditNote, PaginatedResponse } from "@/lib/types";

export const creditNoteKeys = {
  all: ["credit-notes"] as const,
  list: (params: CreditNoteListParams) => ["credit-notes", "list", params] as const,
  detail: (id: string) => ["credit-notes", "detail", id] as const,
};

export interface CreditNoteListParams {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  contactId?: string;
  issuedFrom?: string;
  issuedTo?: string;
}

function qs(params: CreditNoteListParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useCreditNotes(params: CreditNoteListParams) {
  return useQuery({
    queryKey: creditNoteKeys.list(params),
    queryFn: () => apiFetch<PaginatedResponse<CreditNote>>(`/credit-notes${qs(params)}`),
  });
}

export function useCreditNote(id: string | undefined) {
  return useQuery({
    queryKey: id ? creditNoteKeys.detail(id) : ["credit-notes", "detail", "none"],
    queryFn: () => apiFetch<CreditNote>(`/credit-notes/${id}`),
    enabled: !!id,
  });
}

export interface CreditNoteLineInput {
  productServiceId?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountType?: "PERCENTAGE" | "FIXED";
  discountValue?: number;
  taxRateId?: string;
  accountId?: string;
}

export interface CreateCreditNoteInput {
  type: "SALES" | "PURCHASE";
  contactId: string;
  issueDate: string;
  currency?: string;
  reason?: string;
  originalInvoiceId?: string;
  originalBillId?: string;
  lines: CreditNoteLineInput[];
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCreditNoteInput) =>
      apiFetch<CreditNote>("/credit-notes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: creditNoteKeys.all }),
  });
}

export function useUpdateCreditNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateCreditNoteInput>) =>
      apiFetch<CreditNote>(`/credit-notes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: creditNoteKeys.all });
      void qc.invalidateQueries({ queryKey: creditNoteKeys.detail(id) });
    },
  });
}

export function useIssueCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CreditNote>(`/credit-notes/${id}/issue`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: creditNoteKeys.all }),
  });
}

export function useVoidCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<CreditNote>(`/credit-notes/${id}/void`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: creditNoteKeys.all }),
  });
}

export function useDeleteCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/credit-notes/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: creditNoteKeys.all }),
  });
}
