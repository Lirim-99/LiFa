import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";
import { getAccessToken, setActiveCompanyCookie } from "@/lib/session";

/**
 * POST /api/active-company
 *
 * Sets `lifa_company` cookie + tells the backend to flip is_default on the
 * matching UserCompanyAccess row. The cookie is what the proxy injects as
 * X-Company-Id on subsequent requests; the BE update keeps the user's default
 * sticky across browsers / sessions.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { companyId?: string } | null;
  if (!body?.companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const upstream = await fetch(backendUrl("/users/me/switch-company"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ companyId: body.companyId }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const err = (await upstream.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { error: err.message ?? "Failed to switch company" },
      { status: upstream.status },
    );
  }

  await setActiveCompanyCookie(body.companyId);
  return NextResponse.json({ ok: true });
}
