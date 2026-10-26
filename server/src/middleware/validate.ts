import type { RequestHandler } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import { sendError } from '../utils/apiResponse.js';

export function validateBody<Output, Input>(schema: ZodType<Output, ZodTypeDef, Input>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', result.error.flatten());
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<Output, Input>(schema: ZodType<Output, ZodTypeDef, Input>): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return sendError(res, 'Validation failed', 422, 'VALIDATION_ERROR', result.error.flatten());
    }
    (req as Request & { validatedQuery?: Output }).validatedQuery = result.data;
    next();
  };
}

type Request = import('express').Request;
