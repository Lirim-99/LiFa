"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export const quoteKeys = {
  all: ["quotes"] as const,
  list: (params?: QuoteListParams) => ["quotes", "list", params] as const,
  detail: (id: string) => ["quotes", "detail", id] as const,
  orders: (params?: OrderListParams) => ["sales-orders", "list", params] as const,
  order: (id: string) => ["sales-orders", "detail", id] as const,
};

export interface QuoteListParams { page?: number; limit?: number; status?: string }
export interface OrderListParams { page?: number; limit?: number; status?: string }

export interface QuoteLine {
  id: string;
  lineNumber: number;
  productServiceId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxAmount: string;
  totalAmount: string;
}

export interface Quote {
  id: string;
  quoteNumber: string | null;
  contactId: string;
  contact: { id: string; displayName: string };
  issueDate: string;
  expiryDate: string;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  status: string;
  notes: string | null;
  convertedToId: string | null;
  lines: QuoteLine[];
}

export interface SalesOrderLine {
  id: string;
  lineNumber: number;
  productServiceId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxAmount: string;
  totalAmount: string;
  invoicedQty: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string | null;
  contactId: string;
  contact: { id: string; displayName: string };
  orderDate: string;
  deliveryDate: string | null;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  invoicedAmount: string;
  status: string;
  notes: string | null;
  quoteId: string | null;
  lines: SalesOrderLine[];
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ===================== Quotes =====================

export function useQuotes(params?: QuoteListParams) {
  return useQuery({
    queryKey: quoteKeys.list(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.status) qs.set("status", params.status);
      return apiFetch<Paginated<Quote>>(`/quotes?${qs.toString()}`);
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: id ? quoteKeys.detail(id) : ["quotes", "none"],
    queryFn: () => apiFetch<Quote>(`/quotes/${id}`),
    enabled: !!id,
  });
}

export interface QuoteInput {
  contactId: string;
  issueDate: string;
  expiryDate: string;
  currency?: string;
  notes?: string;
  lines: { productServiceId?: string; description: string; quantity: number; unitPrice: number; discountPercent?: number; taxAmount?: number }[];
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: QuoteInput) =>
      apiFetch<Quote>("/quotes", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.all }); },
  });
}

export function useUpdateQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: QuoteInput) =>
      apiFetch<Quote>(`/quotes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.all }); },
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Quote>(`/quotes/${id}/send`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.all }); },
  });
}

export function useAcceptQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Quote>(`/quotes/${id}/accept`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.all }); },
  });
}

export function useRejectQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Quote>(`/quotes/${id}/reject`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.all }); },
  });
}

export function useConvertQuoteToOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => apiFetch<SalesOrder>(`/quotes/${quoteId}/convert-to-order`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.all }); },
  });
}

// ===================== Sales Orders =====================

export function useSalesOrders(params?: OrderListParams) {
  return useQuery({
    queryKey: quoteKeys.orders(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.status) qs.set("status", params.status);
      return apiFetch<Paginated<SalesOrder>>(`/sales-orders?${qs.toString()}`);
    },
  });
}

export function useSalesOrder(id: string | undefined) {
  return useQuery({
    queryKey: id ? quoteKeys.order(id) : ["sales-orders", "none"],
    queryFn: () => apiFetch<SalesOrder>(`/sales-orders/${id}`),
    enabled: !!id,
  });
}

export interface SalesOrderInput {
  contactId: string;
  orderDate: string;
  deliveryDate?: string;
  currency?: string;
  notes?: string;
  quoteId?: string;
  lines: { productServiceId?: string; description: string; quantity: number; unitPrice: number; discountPercent?: number; taxAmount?: number }[];
}

export function useCreateSalesOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SalesOrderInput) =>
      apiFetch<SalesOrder>("/sales-orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.orders() }); },
  });
}

export function useConfirmOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<SalesOrder>(`/sales-orders/${id}/confirm`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.orders() }); },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<SalesOrder>(`/sales-orders/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: quoteKeys.orders() }); },
  });
}
