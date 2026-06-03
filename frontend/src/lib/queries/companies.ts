"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type {
  Company,
  CompanyAddress,
  CompanyActivityCode,
  UserCompanyAccessSummary,
} from "@/lib/types";

// --- Query keys ----------------------------------------------------------

export const companyKeys = {
  all: ["companies"] as const,
  myList: () => ["companies", "mine"] as const,
  detail: (id: string) => ["companies", "detail", id] as const,
  addresses: (id: string) => ["companies", id, "addresses"] as const,
  activityCodes: (id: string) => ["companies", id, "activity-codes"] as const,
};

// --- Reads ---------------------------------------------------------------

export function useMyCompanies() {
  return useQuery({
    queryKey: companyKeys.myList(),
    queryFn: () => apiFetch<UserCompanyAccessSummary[]>("/users/me/companies"),
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: id ? companyKeys.detail(id) : ["companies", "detail", "none"],
    queryFn: () => apiFetch<Company>(`/companies/${id}`),
    enabled: !!id,
  });
}

export function useCompanyAddresses(companyId: string | undefined) {
  return useQuery({
    queryKey: companyId ? companyKeys.addresses(companyId) : ["addresses", "none"],
    queryFn: () => apiFetch<CompanyAddress[]>(`/companies/${companyId}/addresses`),
    enabled: !!companyId,
  });
}

export function useCompanyActivityCodes(companyId: string | undefined) {
  return useQuery({
    queryKey: companyId ? companyKeys.activityCodes(companyId) : ["activity-codes", "none"],
    queryFn: () => apiFetch<CompanyActivityCode[]>(`/companies/${companyId}/activity-codes`),
    enabled: !!companyId,
  });
}

// --- Mutations -----------------------------------------------------------

export interface CreateCompanyInput {
  legalName: string;
  legalForm: string;
  tradeName?: string;
  uinNui?: string;
  fiscalNumber?: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  website?: string;
  defaultCurrency?: string;
  fiscalYearStartMonth?: number;
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: CreateCompanyInput) => {
      const created = await apiFetch<Company>("/companies", {
        method: "POST",
        body: JSON.stringify(input),
      });
      // Make it the active company in this browser session.
      await fetch("/api/active-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: created.id }),
      });
      return created;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.myList() });
      router.refresh();
    },
  });
}

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<CreateCompanyInput>) =>
      apiFetch<Company>(`/companies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: companyKeys.myList() });
    },
  });
}

export function useSwitchCompany() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (companyId: string) => {
      await fetch("/api/active-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      return companyId;
    },
    onSuccess: () => {
      // Switching companies invalidates basically every cache that touches
      // company-scoped data. Easiest: blow away the entire query cache.
      queryClient.clear();
      router.refresh();
    },
  });
}

// --- Address mutations ---------------------------------------------------

export interface AddressInput {
  addressType: string;
  country?: string;
  municipality?: string;
  city?: string;
  street?: string;
  postalCode?: string;
  isPrimary?: boolean;
}

export function useCreateAddress(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) =>
      apiFetch<CompanyAddress>(`/companies/${companyId}/addresses`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.addresses(companyId) });
    },
  });
}

export function useUpdateAddress(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AddressInput & { id: string }) =>
      apiFetch<CompanyAddress>(`/companies/${companyId}/addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.addresses(companyId) });
    },
  });
}

export function useDeleteAddress(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/companies/${companyId}/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.addresses(companyId) });
    },
  });
}

// --- Activity-code mutations ---------------------------------------------

export interface ActivityCodeInput {
  activityType: string;
  code: string;
  description?: string;
  sortOrder?: number;
}

export function useCreateActivityCode(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActivityCodeInput) =>
      apiFetch<CompanyActivityCode>(`/companies/${companyId}/activity-codes`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: companyKeys.activityCodes(companyId),
      });
    },
  });
}

export function useUpdateActivityCode(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ActivityCodeInput & { id: string }) =>
      apiFetch<CompanyActivityCode>(`/companies/${companyId}/activity-codes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: companyKeys.activityCodes(companyId),
      });
    },
  });
}

export function useDeleteActivityCode(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/companies/${companyId}/activity-codes/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: companyKeys.activityCodes(companyId),
      });
    },
  });
}
