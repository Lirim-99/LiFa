import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";
import { setAuthCookies, setActiveCompanyCookie } from "@/lib/session";

interface BackendTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface BackendError {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

/**
 * POST /api/auth/login
 * Exchanges credentials for a JWT pair and stashes them in HttpOnly cookies.
 * The browser never sees the tokens — subsequent calls go through /api/proxy.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const upstream = await fetch(backendUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await upstream.json().catch(() => ({}))) as BackendTokens | BackendError;

  if (!upstream.ok) {
    const err = json as BackendError;
    const message = Array.isArray(err.message)
      ? err.message.join(", ")
      : (err.message ?? "Login failed");
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const tokens = json as BackendTokens;
  await setAuthCookies(tokens);

  // Reset the active-company cookie to the user's default company so a stale
  // cookie from a previous session (or a re-seeded DB) can't cause 403s.
  try {
    const me = await fetch(backendUrl("/users/me/companies"), {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: "no-store",
    });
    if (me.ok) {
      const companies = (await me.json()) as { companyId: string; isDefault: boolean }[];
      const defaultCo = companies.find((c) => c.isDefault) ?? companies[0];
      if (defaultCo) {
        await setActiveCompanyCookie(defaultCo.companyId);
      }
    }
  } catch {
    // Non-fatal — worst case the user can switch company manually.
  }

  return NextResponse.json({ ok: true });
}
