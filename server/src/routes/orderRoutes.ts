import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as orderService from '../services/orderService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/auth.js';
import { Order } from '../models/Order.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  addressId: z.string().regex(/^[a-f\d]{24}$/i),
  paymentMethod: z.enum(['razorpay', 'cod']),
  couponCode: z.string().optional(),
  idempotencyKey: z.string().max(64).optional(),
});

router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const order = await orderService.createOrderFromCart({
      userId: String(user._id),
      ...req.body,
    });
    sendSuccess(res, order, 201);
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const result = await orderService.listUserOrders(String(user._id), page, limit);
    sendSuccess(res, result.items, 200, { total: result.total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const order = await Order.findById(req.params.id);
    if (!order) throw new NotFoundError('Order not found');
    if (String(order.user) !== String(user._id) && user.role !== 'admin') {
      throw new ForbiddenError();
    }
    sendSuccess(res, order);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const order = await orderService.cancelOrder(String(user._id), req.params.id, user.role === 'admin');
    sendSuccess(res, order);
  } catch (e) {
    next(e);
  }
});

export default router;
