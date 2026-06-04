"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PaginatedResponse, ProductService } from "@/lib/types";

export const catalogKeys = {
  all: ["catalog"] as const,
  list: (params: Record<string, string | number | boolean | undefined>) =>
    ["catalog", "list", params] as const,
  detail: (id: string) => ["catalog", "detail", id] as const,
};

export interface CatalogListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: "PRODUCT" | "SERVICE";
  isActive?: boolean;
}

function buildQuery(params: CatalogListParams) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) {
      qs.set(key, String(value));
    }
  }
  return qs.toString();
}

export function useCatalog(params: CatalogListParams) {
  return useQuery({
    queryKey: catalogKeys.list(params as never),
    queryFn: () => {
      const qs = buildQuery(params);
      return apiFetch<PaginatedResponse<ProductService>>(`/products-services${qs ? `?${qs}` : ""}`);
    },
  });
}

export interface ProductServiceInput {
  name: string;
  type: "PRODUCT" | "SERVICE";
  sku?: string;
  description?: string;
  unit?: string;
  salePrice?: number;
  purchasePrice?: number;
  incomeAccountId?: string;
  expenseAccountId?: string;
  defaultTaxRateId?: string;
}

export function useCreateProductService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductServiceInput) =>
      apiFetch<ProductService>("/products-services", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}

export function useUpdateProductService(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProductServiceInput> & { isActive?: boolean }) =>
      apiFetch<ProductService>(`/products-services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}

export function useDeactivateProductService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/products-services/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });
}
