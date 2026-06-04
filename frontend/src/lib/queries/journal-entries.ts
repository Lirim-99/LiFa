"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { JournalEntry, PaginatedResponse } from "@/lib/types";

export const jeKeys = {
  all: ["journal-entries"] as const,
  list: (params: Record<string, unknown>) => ["journal-entries", "list", params] as const,
  detail: (id: string) => ["journal-entries", "detail", id] as const,
};

export interface JournalEntryListParams {
  page?: number;
  limit?: number;
  status?: "DRAFT" | "POSTED";
  sourceType?: string;
  reversed?: boolean;
  from?: string;
  to?: string;
}

function qs(params: JournalEntryListParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useJournalEntries(params: JournalEntryListParams) {
  return useQuery({
    queryKey: jeKeys.list(params),
    queryFn: () => apiFetch<PaginatedResponse<JournalEntry>>(`/journal-entries${qs(params)}`),
  });
}

export function useJournalEntry(id: string | undefined) {
  return useQuery({
    queryKey: id ? jeKeys.detail(id) : ["journal-entries", "detail", "none"],
    queryFn: () => apiFetch<JournalEntry>(`/journal-entries/${id}`),
    enabled: !!id,
  });
}

export interface JournalEntryLineInput {
  accountId: string;
  description?: string;
  debitAmount: number;
  creditAmount: number;
  contactId?: string;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  memo?: string;
  lines: JournalEntryLineInput[];
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJournalEntryInput) =>
      apiFetch<JournalEntry>("/journal-entries", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jeKeys.all }),
  });
}

export function useUpdateJournalEntry(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateJournalEntryInput>) =>
      apiFetch<JournalEntry>(`/journal-entries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: jeKeys.all });
      void qc.invalidateQueries({ queryKey: jeKeys.detail(id) });
    },
  });
}

export function usePostJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<JournalEntry>(`/journal-entries/${id}/post`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jeKeys.all }),
  });
}

export function useVoidJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<JournalEntry>(`/journal-entries/${id}/void`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jeKeys.all }),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/journal-entries/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jeKeys.all }),
  });
}
