const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;
  public requestId?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const requestId = res.headers.get('x-request-id') ?? undefined;
  let json: { success?: boolean; data?: T; error?: { message?: string; code?: string; details?: unknown } };
  try {
    json = await res.json();
  } catch {
    throw new ApiError('The server returned an invalid response.', res.status, 'INVALID_RESPONSE', undefined, requestId);
  }
  if (!res.ok) {
    throw new ApiError(
      json?.error?.message ?? 'Request failed',
      res.status,
      json?.error?.code,
      json?.error?.details,
      requestId,
    );
  }
  if (json?.success !== true || !('data' in json)) {
    throw new ApiError('The server returned an unexpected response.', res.status, 'INVALID_RESPONSE', undefined, requestId);
  }
  return json as T;
}

async function request(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error) {
    if (!timedOut && init.signal?.aborted) throw error;
    if (!timedOut && error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      timedOut ? 'The request timed out. Please try again.' : 'Unable to reach the service. Check your connection and try again.',
      0,
      timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function apiGet<T>(path: string, init?: RequestInit) {
  const res = await request(path, init);
  const json = await parseResponse<{ success: boolean; data: T; meta?: Record<string, unknown> }>(res);
  return { data: json.data, meta: json.meta };
}

export async function apiSend<T>(path: string, method: string, body?: unknown, init?: RequestInit) {
  const isForm = body instanceof FormData;
  const res = await request(path, {
    method,
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
