import { NextResponse, type NextRequest } from "next/server";
import { backendUrl } from "@/lib/backend";
import { getAccessToken, getActiveCompanyId } from "@/lib/session";

/**
 * Catch-all proxy to NestJS.
 *
 *   browser → /api/proxy/contacts?... → NestJS /contacts?...
 *
 * Injects:
 *   - Authorization: Bearer <access_token>   from HttpOnly cookie
 *   - X-Company-Id: <active_company>          from HttpOnly cookie (if set)
 *
 * Hop-by-hop request headers are dropped automatically by fetch. We forward
 * the request body unchanged.
 */
async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.length ? path.join("/") : "";
  const search = request.nextUrl.search ?? "";

  const [accessToken, companyId] = await Promise.all([getAccessToken(), getActiveCompanyId()]);

  const outgoing = new Headers();
  for (const [key, value] of request.headers.entries()) {
    // Skip cookies (no need to leak browser cookies upstream) and host headers
    if (key === "cookie" || key === "host" || key === "connection") continue;
    outgoing.set(key, value);
  }
  if (accessToken) outgoing.set("authorization", `Bearer ${accessToken}`);
  if (companyId) outgoing.set("x-company-id", companyId);

  const upstreamUrl = backendUrl(`/${target}${search}`);
  const init: RequestInit = {
    method: request.method,
    headers: outgoing,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  };

  const response = await fetch(upstreamUrl, init);

  // Mirror status + body. Strip transfer-encoding / connection headers that
  // would confuse the runtime. Crucially, `fetch` has already DECODED the
  // upstream body (Render serves Brotli/gzip), so we must drop the stale
  // content-encoding / content-length headers — otherwise the browser tries to
  // re-decode plain bytes and the response body "terminates". We buffer the
  // (small JSON) body rather than re-streaming it, which also avoids premature
  // stream termination on serverless.
  const buffer = await response.arrayBuffer();
  const respHeaders = new Headers();
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "transfer-encoding" ||
      lower === "connection" ||
      lower === "content-encoding" ||
      lower === "content-length"
    ) {
      return;
    }
    respHeaders.set(key, value);
  });

  return new NextResponse(buffer, {
    status: response.status,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
