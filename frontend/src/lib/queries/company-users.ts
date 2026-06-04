"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { RoleCode } from "@/lib/types";

export interface CompanyUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleCode: RoleCode;
  isDefault: boolean;
}

export const companyUserKeys = {
  list: (companyId: string) => ["company-users", companyId] as const,
};

export function useCompanyUsers(companyId: string | undefined) {
  return useQuery({
    queryKey: companyId ? companyUserKeys.list(companyId) : ["company-users", "none"],
    queryFn: () => apiFetch<CompanyUser[]>(`/companies/${companyId}/users`),
    enabled: !!companyId,
  });
}

export function useAddCompanyUser(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; roleCode: RoleCode }) =>
      apiFetch(`/companies/${companyId}/users`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: companyUserKeys.list(companyId) }),
  });
}

export function useUpdateCompanyUser(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleCode }: { userId: string; roleCode: RoleCode }) =>
      apiFetch(`/companies/${companyId}/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ roleCode }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: companyUserKeys.list(companyId) }),
  });
}

export function useRemoveCompanyUser(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/companies/${companyId}/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: companyUserKeys.list(companyId) }),
  });
}
