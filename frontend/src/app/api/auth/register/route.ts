import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";
import { setAuthCookies } from "@/lib/session";

interface RegisterBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface BackendTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * POST /api/auth/register
 * Creates the user via NestJS, then logs them in immediately so the flow lands
 * the user on the dashboard rather than asking them to log in twice.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RegisterBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const registerRes = await fetch(backendUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!registerRes.ok) {
    const err = (await registerRes.json().catch(() => ({ message: "Registration failed" }))) as {
      message?: string | string[];
    };
    const message = Array.isArray(err.message)
      ? err.message.join(", ")
      : (err.message ?? "Registration failed");
    return NextResponse.json({ error: message }, { status: registerRes.status });
  }

  const loginRes = await fetch(backendUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });
  if (!loginRes.ok) {
    return NextResponse.json(
      { error: "Account created but automatic sign-in failed. Please log in." },
      { status: 500 },
    );
  }

  const tokens = (await loginRes.json()) as BackendTokens;
  await setAuthCookies(tokens);
  return NextResponse.json({ ok: true }, { status: 201 });
}
