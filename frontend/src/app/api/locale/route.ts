import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/lib/session";

/**
 * POST /api/locale
 *
 * Sets the `lifa_locale` cookie so the next render (after router.refresh())
 * picks up the chosen UI language. No auth required — it's a display preference.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { locale?: string } | null;
  if (!body?.locale || !isLocale(body.locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  await setLocaleCookie(body.locale);
  return NextResponse.json({ ok: true });
}
