import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, status = 200, meta?: Record<string, unknown>) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  code?: string,
  details?: unknown,
) {
  return res.status(status).json({
    success: false,
    error: { message, code, details },
  });
}
