import "server-only";

/**
 * Server-side fetch wrapper for the NestJS backend.
 * Only used by Route Handlers and Server Components — never imported into Client Components.
 */
export function backendUrl(path: string): string {
  const base = process.env.BACKEND_API_URL;
  if (!base) {
    throw new Error("BACKEND_API_URL is not configured. See frontend/.env.example.");
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
