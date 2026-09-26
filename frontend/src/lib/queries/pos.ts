"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export const posKeys = {
  all: ["pos"] as const,
  registers: () => ["pos", "registers"] as const,
  session: () => ["pos", "session"] as const,
  sales: (sessionId: string) => ["pos", "sales", sessionId] as const,
  products: (q: string) => ["pos", "products", q] as const,
};

// ===================== Types =====================

export interface PosRegister {
  id: string;
  name: string;
  isActive: boolean;
}

export interface PosSession {
  id: string;
  registerId: string;
  status: "OPEN" | "CLOSED";
  openingBalance: string;
  closingBalance: string | null;
  expectedBalance: string | null;
  openedAt: string;
  closedAt: string | null;
  register: { id: string; name: string };
}

export interface PosSaleLine {
  id: string;
  lineNumber: number;
  productServiceId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  taxAmount: string;
  totalAmount: string;
}

export interface PosSale {
  id: string;
  saleNumber: number;
  status: "COMPLETED" | "VOIDED";
  paymentMethod: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  changeGiven: string;
  customerName: string | null;
  createdAt: string;
  lines: PosSaleLine[];
}

export interface PosProduct {
  id: string;
  name: string;
  sku: string | null;
  salePrice: string | null;
  type: string;
  unit: string | null;
  defaultTaxRate: { rate: string; calculationType: string } | null;
}

// ===================== Registers =====================

export function usePosRegisters() {
  return useQuery({
    queryKey: posKeys.registers(),
    queryFn: () => apiFetch<PosRegister[]>("/pos/registers"),
  });
}

export function useCreateRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<PosRegister>("/pos/registers", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: posKeys.registers() }); },
  });
}

// ===================== Sessions =====================

export function useCurrentSession() {
  return useQuery({
    queryKey: posKeys.session(),
    queryFn: () => apiFetch<PosSession | null>("/pos/sessions/current"),
  });
}

export function useOpenSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { registerId: string; openingBalance: number }) =>
      apiFetch<PosSession>("/pos/sessions/open", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: posKeys.session() }); },
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, closingBalance }: { sessionId: string; closingBalance: number }) =>
      apiFetch<PosSession>(`/pos/sessions/${sessionId}/close`, {
        method: "POST",
        body: JSON.stringify({ closingBalance }),
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: posKeys.session() }); },
  });
}

// ===================== Sales =====================

export function useSessionSales(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? posKeys.sales(sessionId) : ["pos", "sales", "none"],
    queryFn: () => apiFetch<PosSale[]>(`/pos/sessions/${sessionId}/sales`),
    enabled: !!sessionId,
  });
}

export interface CreateSaleInput {
  sessionId: string;
  paymentMethod: string;
  amountPaid: number;
  customerName?: string;
  lines: { productServiceId: string; quantity: number; unitPrice: number }[];
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSaleInput) =>
      apiFetch<PosSale>("/pos/sales", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: posKeys.all }); },
  });
}

// ===================== Product Search =====================

export function usePosProducts(query: string) {
  return useQuery({
    queryKey: posKeys.products(query),
    queryFn: () => apiFetch<PosProduct[]>(`/pos/products?q=${encodeURIComponent(query)}`),
  });
}
