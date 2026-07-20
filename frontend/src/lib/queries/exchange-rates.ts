"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export const fxKeys = {
  all: ["exchange-rates"] as const,
  list: (currency?: string) => ["exchange-rates", "list", currency] as const,
};

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: string;
  effectiveDate: string;
}

export function useExchangeRates(currency?: string) {
  return useQuery({
    queryKey: fxKeys.list(currency),
    queryFn: () => {
      const qs = currency ? `?currency=${encodeURIComponent(currency)}` : "";
      return apiFetch<ExchangeRate[]>(`/exchange-rates${qs}`);
    },
  });
}

export interface UpsertRateInput {
  baseCurrency?: string;
  targetCurrency: string;
  rate: number;
  effectiveDate: string;
}

export function useUpsertRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertRateInput) =>
      apiFetch<ExchangeRate>("/exchange-rates", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: fxKeys.all }); },
  });
}

export function useDeleteRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/exchange-rates/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: fxKeys.all }); },
  });
}
