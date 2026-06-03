"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { TaxRate } from "@/lib/types";

export const taxKeys = {
  all: ["tax-rates"] as const,
  list: () => ["tax-rates", "list"] as const,
};

export function useTaxRates() {
  return useQuery({
    queryKey: taxKeys.list(),
    queryFn: () => apiFetch<TaxRate[]>("/tax-rates"),
  });
}

export interface TaxRateInput {
  name: string;
  code: string;
  rate: number;
  calculationType: "EXCLUSIVE" | "INCLUSIVE";
  scope: "SALES" | "PURCHASES" | "BOTH";
  isDefault?: boolean;
}

export function useCreateTaxRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaxRateInput) =>
      apiFetch<TaxRate>("/tax-rates", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taxKeys.all });
    },
  });
}

export function useUpdateTaxRate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TaxRateInput> & { isActive?: boolean }) =>
      apiFetch<TaxRate>(`/tax-rates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taxKeys.all });
    },
  });
}

export function useDeactivateTaxRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/tax-rates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taxKeys.all });
    },
  });
}
