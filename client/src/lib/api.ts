const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? 'Request failed', res.status, json?.error?.code, json?.error?.details);
  }
  return json as T;
}

export async function apiGet<T>(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
  const json = await parseResponse<{ success: boolean; data: T; meta?: Record<string, unknown> }>(res);
  return { data: json.data, meta: json.meta };
}

export async function apiSend<T>(path: string, method: string, body?: unknown, init?: RequestInit) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...init?.headers },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    ...init,
  });
  const json = await parseResponse<{ success: boolean; data: T; meta?: Record<string, unknown> }>(res);
  return { data: json.data, meta: json.meta };
}

export const api = {
  get: <T>(path: string) => apiGet<T>(path),
  post: <T>(path: string, body?: unknown) => apiSend<T>(path, 'POST', body),
  patch: <T>(path: string, body?: unknown) => apiSend<T>(path, 'PATCH', body),
  delete: <T>(path: string) => apiSend<T>(path, 'DELETE'),
};
