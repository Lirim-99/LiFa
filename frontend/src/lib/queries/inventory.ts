"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export const inventoryKeys = {
  all: ["inventory"] as const,
  warehouses: () => ["inventory", "warehouses"] as const,
  movements: (params?: MovementListParams) => ["inventory", "movements", params] as const,
  stockLevels: (params?: StockLevelParams) => ["inventory", "stock-levels", params] as const,
};

// ===================== Types =====================

export interface Warehouse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  type: string;
  quantity: string;
  unitCost: string | null;
  reference: string | null;
  notes: string | null;
  movementDate: string;
  createdAt: string;
  warehouse: { id: string; code: string; name: string };
  productService: { id: string; name: string; sku: string | null };
}

export interface StockLevel {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productServiceId: string;
  productName: string;
  sku: string | null;
  unit: string | null;
  quantityOnHand: number;
  totalIn: number;
  totalOut: number;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ===================== Warehouses =====================

export function useWarehouses() {
  return useQuery({
    queryKey: inventoryKeys.warehouses(),
    queryFn: () => apiFetch<Warehouse[]>("/inventory/warehouses"),
  });
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  address?: string;
  isDefault?: boolean;
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWarehouseInput) =>
      apiFetch<Warehouse>("/inventory/warehouses", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() }); },
  });
}

export interface UpdateWarehouseInput {
  name?: string;
  address?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateWarehouseInput & { id: string }) =>
      apiFetch<Warehouse>(`/inventory/warehouses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() }); },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/inventory/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() }); },
  });
}

// ===================== Stock Movements =====================

export interface MovementListParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  productServiceId?: string;
  type?: string;
  fromDate?: string;
  toDate?: string;
}

export function useStockMovements(params?: MovementListParams) {
  return useQuery({
    queryKey: inventoryKeys.movements(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
      if (params?.productServiceId) qs.set("productServiceId", params.productServiceId);
      if (params?.type) qs.set("type", params.type);
      if (params?.fromDate) qs.set("fromDate", params.fromDate);
      if (params?.toDate) qs.set("toDate", params.toDate);
      return apiFetch<Paginated<StockMovement>>(`/inventory/movements?${qs.toString()}`);
    },
  });
}

export interface CreateMovementInput {
  warehouseId: string;
  productServiceId: string;
  type: string;
  quantity: number;
  unitCost?: number;
  reference?: string;
  notes?: string;
  movementDate: string;
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMovementInput) =>
      apiFetch<StockMovement>("/inventory/movements", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: inventoryKeys.all }); },
  });
}

// ===================== Stock Levels =====================

export interface StockLevelParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  productServiceId?: string;
}

export function useStockLevels(params?: StockLevelParams) {
  return useQuery({
    queryKey: inventoryKeys.stockLevels(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
      if (params?.productServiceId) qs.set("productServiceId", params.productServiceId);
      return apiFetch<Paginated<StockLevel>>(`/inventory/stock-levels?${qs.toString()}`);
    },
  });
}
