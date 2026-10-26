import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.code, err.details);
  }
  if (err?.name === 'ValidationError') {
    return sendError(res, 'Validation error', 422, 'MONGOOSE_VALIDATION', err.message);
  }
  if (err?.code === 11000) {
    return sendError(res, 'Duplicate value', 409, 'DUPLICATE_KEY', err.keyValue);
  }
  logger.error('Unhandled error', { err });
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err?.message ?? 'Error';
  return sendError(res, message, 500, 'INTERNAL_ERROR');
};
