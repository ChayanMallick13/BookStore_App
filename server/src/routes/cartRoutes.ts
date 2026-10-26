import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as cartService from '../services/cartService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/auth.js';
import { routeParam } from '../utils/routeParam.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const cart = await cartService.getOrCreateCart(String(user._id));
    sendSuccess(res, cart);
  } catch (e) {
    next(e);
  }
});

const addSchema = z.object({
  bookId: z.string().regex(/^[a-f\d]{24}$/i),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

router.post('/items', validateBody(addSchema), async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const cart = await cartService.addToCart(String(user._id), req.body.bookId, req.body.quantity);
    sendSuccess(res, cart);
  } catch (e) {
    next(e);
  }
});

const updateSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

router.patch('/items/:bookId', validateBody(updateSchema), async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const cart = await cartService.updateCartItem(
      String(user._id),
      routeParam(req.params.bookId),
      req.body.quantity,
    );
    sendSuccess(res, cart);
  } catch (e) {
    next(e);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const cart = await cartService.clearCart(String(user._id));
    sendSuccess(res, cart);
  } catch (e) {
    next(e);
  }
});

export default router;
