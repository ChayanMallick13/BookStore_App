import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { errorDetails } from '../utils/errorDetails.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return sendError(
      res,
      tooLarge ? 'Uploaded file exceeds the maximum size' : 'Invalid file upload',
      tooLarge ? 413 : 400,
      tooLarge ? 'UPLOAD_FILE_TOO_LARGE' : `UPLOAD_${err.code}`,
    );
  }
  if (err instanceof AppError) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.warn('Authentication or authorization request rejected', {
        operation: 'auth.request',
        requestId: res.locals.requestId,
        method: _req.method,
        route: _req.path,
        status: err.statusCode,
        code: err.code,
      });
    }
    return sendError(
      res,
      err.message,
      err.statusCode,
      err.code,
      env.NODE_ENV === 'production' ? undefined : err.details,
    );
  }
  if (err?.name === 'ValidationError') {
    return sendError(
      res,
      'Validation error',
      422,
      'MONGOOSE_VALIDATION',
      env.NODE_ENV === 'production' ? undefined : err.message,
    );
  }
  if (err?.code === 11000) {
    return sendError(res, 'Duplicate value', 409, 'DUPLICATE_KEY');
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, 'Malformed JSON request body', 400, 'INVALID_JSON');
  }

  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status >= 500) {
    logger.error('Unhandled request error', {
      requestId: res.locals.requestId,
      method: _req.method,
      route: _req.path,
      error: errorDetails(err),
    });
  }
  const message = status === 500
    ? env.NODE_ENV === 'production' ? 'Internal server error' : err?.message ?? 'Error'
    : err?.message ?? 'Invalid request';
  return sendError(res, message, status, status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST');
};
