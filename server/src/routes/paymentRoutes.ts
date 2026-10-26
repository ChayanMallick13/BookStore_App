import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as paymentService from '../services/paymentService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/razorpay/order', authenticate, async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return sendError(res, 'orderId required', 422);
    const data = await paymentService.createRazorpayOrder(String(user._id), orderId);
    sendSuccess(res, data);
  } catch (e) {
    next(e);
  }
});

const confirmSchema = z.object({
  orderId: z.string().regex(/^[a-f\d]{24}$/i),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

router.post('/razorpay/verify', authenticate, validateBody(confirmSchema), async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const order = await paymentService.confirmRazorpayPayment({
      ...req.body,
      userId: String(user._id),
    });
    sendSuccess(res, order);
  } catch (e) {
    next(e);
  }
});

export default router;
