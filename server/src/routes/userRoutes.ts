import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { Address } from '../models/Address.js';
import { Wishlist } from '../models/Wishlist.js';
import { Book } from '../models/Book.js';
import { sendSuccess } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/auth.js';
import { NotFoundError } from '../utils/errors.js';
import { validateCoupon } from '../services/couponService.js';

const router = Router();

router.use(authenticate);

const addressSchema = z.object({
  label: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(8),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().default('India'),
  isDefault: z.boolean().optional(),
});

router.get('/addresses', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const items = await Address.find({ user: user._id }).sort({ isDefault: -1, createdAt: -1 });
    sendSuccess(res, items);
  } catch (e) {
    next(e);
  }
});

router.post('/addresses', validateBody(addressSchema), async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    if (req.body.isDefault) {
      await Address.updateMany({ user: user._id }, { isDefault: false });
    }
    const address = await Address.create({ ...req.body, user: user._id });
    sendSuccess(res, address, 201);
  } catch (e) {
    next(e);
  }
});

router.get('/wishlist', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const list = await Wishlist.findOne({ user: user._id }).populate({
      path: 'books',
      match: { isActive: true, isArchived: false },
    });
    sendSuccess(res, list?.books ?? []);
  } catch (e) {
    next(e);
  }
});

router.post('/wishlist/:bookId', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const book = await Book.findById(req.params.bookId);
    if (!book) throw new NotFoundError('Book not found');
    const list = await Wishlist.findOneAndUpdate(
      { user: user._id },
      { $addToSet: { books: book._id } },
      { upsert: true, new: true },
    ).populate('books');
    sendSuccess(res, list?.books ?? []);
  } catch (e) {
    next(e);
  }
});

router.delete('/wishlist/:bookId', async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const list = await Wishlist.findOneAndUpdate(
      { user: user._id },
      { $pull: { books: req.params.bookId } },
      { new: true },
    ).populate('books');
    sendSuccess(res, list?.books ?? []);
  } catch (e) {
    next(e);
  }
});

router.post('/coupons/validate', async (req, res, next) => {
  try {
    const { code, subtotal } = req.body as { code?: string; subtotal?: number };
    if (!code || subtotal === undefined) return sendSuccess(res, { valid: false });
    const result = await validateCoupon(code, subtotal);
    sendSuccess(res, { valid: true, discount: result.discount, code: result.coupon.code });
  } catch (e) {
    next(e);
  }
});

export default router;
