"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { AccountingPeriod } from "@/lib/types";

export const periodKeys = {
  all: ["periods"] as const,
  list: (fiscalYear?: number) => ["periods", "list", fiscalYear] as const,
};

export function usePeriods(fiscalYear?: number) {
  return useQuery({
    queryKey: periodKeys.list(fiscalYear),
    queryFn: () => {
      const qs = fiscalYear ? `?fiscalYear=${fiscalYear}` : "";
      return apiFetch<AccountingPeriod[]>(`/accounting-periods${qs}`);
    },
  });
}

export function useGeneratePeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fiscalYear: number) =>
      apiFetch<AccountingPeriod[]>("/accounting-periods/generate", {
        method: "POST",
        body: JSON.stringify({ fiscalYear }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: periodKeys.all }),
  });
}

export function useClosePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AccountingPeriod>(`/accounting-periods/${id}/close`, { method: "PATCH" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: periodKeys.all }),
  });
}

export function useReopenPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AccountingPeriod>(`/accounting-periods/${id}/reopen`, { method: "PATCH" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: periodKeys.all }),
  });
}
