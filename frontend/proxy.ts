import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate (Next.js 16 `proxy.ts`, formerly `middleware.ts`).
 * Reads the access-token cookie's PRESENCE only — we don't decrypt or verify
 * here, since the backend validates the JWT on every API call. This is enough
 * to route unauthenticated users away from app pages.
 */

const PUBLIC_ROUTES = new Set(["/login", "/register"]);
const COOKIE_ACCESS_TOKEN = "lifa_at";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Don't gate API routes — they each handle auth themselves.
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const hasToken = req.cookies.has(COOKIE_ACCESS_TOKEN);
  const isPublic = PUBLIC_ROUTES.has(pathname);

  if (!hasToken && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (hasToken && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
