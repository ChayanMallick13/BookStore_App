import type { Request, Response } from 'express';
import multer from 'multer';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/errors.js';
import { errorDetails } from '../utils/errorDetails.js';
import { logger } from '../utils/logger.js';
import { setupTestDb, teardownTestDb, getTestApp } from './helpers.js';

describe('request diagnostics and safe errors', () => {
  const app = getTestApp();

  beforeAll(async () => setupTestDb());
  afterAll(async () => teardownTestDb());

  it('generates its own request ID and includes it in error responses', async () => {
    const response = await request(app)
      .get('/missing-route')
      .set('X-Request-ID', 'untrusted-client-value');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toMatch(/^[\da-f-]{36}$/i);
    expect(response.headers['x-request-id']).not.toBe('untrusted-client-value');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('rejects browser mutations from an untrusted origin', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://attacker.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('returns a consistent client error for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('serializes errors without leaking credentials, tokens, or email addresses', () => {
    const details = errorDetails(new Error(
      'Request failed for reader@example.com: password=hunter2 Bearer abc.def.ghi',
    ));
    const serialized = JSON.stringify(details);

    expect(serialized).not.toContain('reader@example.com');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('abc.def.ghi');
  });

  it('logs unexpected errors with a stack and correlation ID while returning a safe envelope', () => {
    const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    const req = { method: 'GET', path: '/unexpected' } as Request;
    const res = {
      locals: { requestId: 'server-generated-id' },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    errorHandler(new Error('unexpected failure'), req, res, vi.fn());

    expect(errorLog).toHaveBeenCalledWith(
      'Unhandled request error',
      expect.objectContaining({
        requestId: 'server-generated-id',
        route: '/unexpected',
        error: expect.objectContaining({
          message: 'unexpected failure',
          stack: expect.any(String),
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: 'INTERNAL_ERROR', requestId: 'server-generated-id' }),
    }));
    errorLog.mockRestore();
  });

  it('returns a useful payload-too-large response for oversized uploads', () => {
    const response = {
      locals: { requestId: 'upload-request-id' },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    errorHandler(
      new multer.MulterError('LIMIT_FILE_SIZE'),
      { method: 'POST', path: '/admin/books' } as Request,
      response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: 'UPLOAD_FILE_TOO_LARGE',
        requestId: 'upload-request-id',
      }),
    }));
  });

  it('logs auth rejections with correlation metadata but without credentials', () => {
    const warning = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    const response = {
      locals: { requestId: 'auth-request-id' },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    errorHandler(
      new AppError('Invalid credentials for reader@example.com', 401, 'UNAUTHORIZED'),
      { method: 'POST', path: '/api/v1/auth/login' } as Request,
      response,
      vi.fn(),
    );

    expect(warning).toHaveBeenCalledWith(
      'Authentication or authorization request rejected',
      expect.objectContaining({
        operation: 'auth.request',
        requestId: 'auth-request-id',
        method: 'POST',
        route: '/api/v1/auth/login',
        status: 401,
        code: 'UNAUTHORIZED',
      }),
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain('reader@example.com');
    warning.mockRestore();
  });
});
