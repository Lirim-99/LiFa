"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Contact, PaginatedResponse } from "@/lib/types";

export const contactKeys = {
  all: ["contacts"] as const,
  list: (params: Record<string, string | number | boolean | undefined>) =>
    ["contacts", "list", params] as const,
  detail: (id: string) => ["contacts", "detail", id] as const,
};

export interface ContactsListParams {
  page?: number;
  limit?: number;
  search?: string;
  isCustomer?: boolean;
  isVendor?: boolean;
  isActive?: boolean;
}

function buildQuery(params: ContactsListParams) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) {
      qs.set(key, String(value));
    }
  }
  return qs.toString();
}

export function useContacts(params: ContactsListParams) {
  return useQuery({
    queryKey: contactKeys.list(params as never),
    queryFn: () => {
      const qs = buildQuery(params);
      return apiFetch<PaginatedResponse<Contact>>(`/contacts${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: id ? contactKeys.detail(id) : ["contacts", "detail", "none"],
    queryFn: () => apiFetch<Contact>(`/contacts/${id}`),
    enabled: !!id,
  });
}

export interface ContactInput {
  displayName: string;
  legalName?: string;
  isCustomer?: boolean;
  isVendor?: boolean;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentTermsDays?: number;
  currency?: string;
  country?: string;
  municipality?: string;
  city?: string;
  street?: string;
  postalCode?: string;
  notes?: string;
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ContactInput) =>
      apiFetch<Contact>("/contacts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ContactInput> & { isActive?: boolean }) =>
      apiFetch<Contact>(`/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
      void queryClient.invalidateQueries({ queryKey: contactKeys.detail(id) });
    },
  });
}
