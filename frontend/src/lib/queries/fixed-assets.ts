"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export const assetKeys = {
  all: ["fixed-assets"] as const,
  list: (status?: string) => ["fixed-assets", "list", status] as const,
  detail: (id: string) => ["fixed-assets", "detail", id] as const,
};

export interface FixedAsset {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  purchaseDate: string;
  purchaseCost: string;
  residualValue: string;
  usefulLifeMonths: number;
  depreciationMethod: string;
  accumulatedDepr: string;
  netBookValue: string;
  status: string;
  disposalDate: string | null;
  disposalAmount: string | null;
  _count?: { depreciationEntries: number };
}

export interface DepreciationEntry {
  id: string;
  periodDate: string;
  amount: string;
}

export interface AssetDetail extends FixedAsset {
  depreciationEntries: DepreciationEntry[];
}

export function useFixedAssets(status?: string) {
  return useQuery({
    queryKey: assetKeys.list(status),
    queryFn: () => {
      const qs = status ? `?status=${status}` : "";
      return apiFetch<FixedAsset[]>(`/fixed-assets${qs}`);
    },
  });
}

export function useFixedAsset(id: string | undefined) {
  return useQuery({
    queryKey: id ? assetKeys.detail(id) : ["fixed-assets", "none"],
    queryFn: () => apiFetch<AssetDetail>(`/fixed-assets/${id}`),
    enabled: !!id,
  });
}

export interface AssetInput {
  name: string;
  code?: string;
  category?: string;
  purchaseDate: string;
  purchaseCost: number;
  residualValue?: number;
  usefulLifeMonths: number;
  depreciationMethod?: string;
  notes?: string;
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AssetInput) =>
      apiFetch<FixedAsset>("/fixed-assets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: assetKeys.all }); },
  });
}

export function useRunDepreciation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodDate: string) =>
      apiFetch<{ assetsProcessed: number }>("/fixed-assets/depreciate", {
        method: "POST",
        body: JSON.stringify({ periodDate }),
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: assetKeys.all }); },
  });
}

export function useDisposeAsset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { disposalDate: string; disposalAmount: number }) =>
      apiFetch<FixedAsset>(`/fixed-assets/${id}/dispose`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: assetKeys.all }); },
  });
}
