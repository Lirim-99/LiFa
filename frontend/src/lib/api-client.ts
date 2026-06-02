/**
 * Client-side fetch wrapper. All FE → BE calls go through this so the BFF
 * proxy can attach the JWT cookie and forward to NestJS.
 *
 *   apiFetch<Contact>('/contacts/abc-123')
 *   apiFetch<{ id: string }>('/contacts', { method: 'POST', body })
 */

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  constructor(status: number, body: ApiErrorBody | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("/api/proxy") ? path : `/api/proxy${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  const data = text.length ? safeJsonParse(text) : null;

  if (!response.ok) {
    const body = data as ApiErrorBody | null;
    const message = body
      ? Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message
      : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, body, message);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
