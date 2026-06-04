"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PaginatedResponse } from "@/lib/types";

export interface AuditLogRow {
  id: string;
  companyId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  occurredAt: string;
  ipAddress: string | null;
  user?: { id: string; email: string; firstName: string; lastName: string };
}

export interface AuditFilterParams {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
  userId?: string;
  occurredFrom?: string;
  occurredTo?: string;
}

function qs(params: AuditFilterParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useAuditLogs(params: AuditFilterParams) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => apiFetch<PaginatedResponse<AuditLogRow>>(`/audit-logs${qs(params)}`),
  });
}
