import "server-only";
import { backendUrl } from "@/lib/backend";
import { getAccessToken, getActiveCompanyId } from "@/lib/session";

/**
 * Server-side equivalent of apiFetch — used by Server Components and Route
 * Handlers to call NestJS directly (no /api/proxy round-trip). Attaches the
 * same Authorization + X-Company-Id headers.
 *
 * Returns `null` on 401/403/404 instead of throwing, so a Server Component can
 * decide whether to redirect or render an empty state.
 */
export async function serverFetch<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const [accessToken, companyId] = await Promise.all([getAccessToken(), getActiveCompanyId()]);
  if (!accessToken) return null;

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (companyId) headers.set("x-company-id", companyId);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(backendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Backend ${response.status} on ${path}`);
  }
  if (response.status === 204) return null;
  return (await response.json()) as T;
}
