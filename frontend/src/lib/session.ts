import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * HttpOnly cookie names used by the BFF. Browser JS cannot read these —
 * they're injected back into outgoing requests by the proxy route handler.
 */
export const COOKIE_ACCESS_TOKEN = "lifa_at";
export const COOKIE_REFRESH_TOKEN = "lifa_rt";
export const COOKIE_ACTIVE_COMPANY = "lifa_company";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Persist a fresh login. Access token lifetime mirrors the backend's
 * JWT_ACCESS_EXPIRES_IN (we pass `expiresIn` seconds from /auth/login).
 */
export async function setAuthCookies(args: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_ACCESS_TOKEN, args.accessToken, {
    ...COOKIE_BASE,
    maxAge: args.expiresIn,
  });
  store.set(COOKIE_REFRESH_TOKEN, args.refreshToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 30, // 30 days; backend's JWT_REFRESH_EXPIRES_IN can be shorter.
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_ACCESS_TOKEN);
  store.delete(COOKIE_REFRESH_TOKEN);
  store.delete(COOKIE_ACTIVE_COMPANY);
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_ACCESS_TOKEN)?.value;
}

export async function getActiveCompanyId(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_ACTIVE_COMPANY)?.value;
}

export async function setActiveCompanyCookie(companyId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_ACTIVE_COMPANY, companyId, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 365, // 1 year — sticky preference
  });
}

/**
 * Persist the UI language preference. Not HttpOnly — it's not sensitive and the
 * locale switcher reads it client-side. Read back by `getLocale()` in i18n/server.
 */
export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year — sticky preference
  });
}
