import type { RequestHandler } from 'express';
import * as bookService from '../services/bookService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { publicUploadPath } from '../middleware/upload.js';
import type { AuthRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { routeParam } from '../utils/routeParam.js';

export const listBooks: RequestHandler = async (req, res, next) => {
  try {
    const validatedQuery =
      (req as import('express').Request & { validatedQuery?: Parameters<typeof bookService.listBooks>[0] })
        .validatedQuery ?? { ...req.query };
    const query = {
      ...validatedQuery,
      admin: (req as AuthRequest).user?.role === 'admin',
    } as Parameters<typeof bookService.listBooks>[0];
    const result = await bookService.listBooks(query);
    sendSuccess(res, result.items, 200, result.meta);
  } catch (e) {
    next(e);
  }
};

export const getBook: RequestHandler = async (req, res, next) => {
  try {
    const book = req.params.slug
      ? await bookService.getBookBySlug(routeParam(req.params.slug))
      : await bookService.getBookById(routeParam(req.params.id));
    sendSuccess(res, book);
  } catch (e) {
    next(e);
  }
};

export const createBook: RequestHandler = async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const coverImages = files.map((f) => publicUploadPath(f.filename));
    const user = (req as AuthRequest).user!;
    const book = await bookService.createBook(req.body, coverImages, String(user._id));
    await logAudit({
      actorId: user._id,
      action: 'book.create',
      resourceType: 'Book',
      resourceId: String(book.id),
      ip: req.ip,
    });
    sendSuccess(res, book, 201);
  } catch (e) {
    next(e);
  }
};

export const updateBook: RequestHandler = async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const coverImages = files.length ? files.map((f) => publicUploadPath(f.filename)) : undefined;
    const user = (req as AuthRequest).user!;
    const bookId = routeParam(req.params.id);
    const book = await bookService.updateBook(bookId, req.body, coverImages, String(user._id));
    await logAudit({
      actorId: user._id,
      action: 'book.update',
      resourceType: 'Book',
      resourceId: bookId,
      ip: req.ip,
    });
    sendSuccess(res, book);
  } catch (e) {
    next(e);
  }
};

export const deleteBook: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const bookId = routeParam(req.params.id);
    const result = await bookService.deleteBook(bookId);
    await logAudit({
      actorId: user._id,
      action: result.archived ? 'book.archive' : 'book.delete',
      resourceType: 'Book',
      resourceId: bookId,
      ip: req.ip,
    });
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};
