import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { bookQuerySchema, bookCreateSchema, bookUpdateSchema } from '../validators/bookValidators.js';
import * as bookController from '../controllers/bookController.js';
import * as adminService from '../services/adminService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { Category } from '../models/Category.js';
import { Author } from '../models/Author.js';
import { Coupon } from '../models/Coupon.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { Review } from '../models/Review.js';
import { InventoryTransaction } from '../models/InventoryTransaction.js';
import slugify from 'slugify';
import { uploadBookImages, validateUploadedBookImages } from '../middleware/upload.js';
import { logAudit } from '../services/auditService.js';
import { getBookById } from '../services/bookService.js';
import { routeParam } from '../utils/routeParam.js';
import type { AuthRequest } from '../middleware/auth.js';
import * as orderService from '../services/orderService.js';
import type { OrderStatus } from '../models/Order.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const reportDateSchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
}).refine(({ from, to }) => !from || !to || from <= to, {
  message: '"from" must not be after "to"',
});

function dateRange(query: { from?: string; to?: string }) {
  return {
    from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
    to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
  };
}

router.get('/dashboard', validateQuery(reportDateSchema), async (req, res, next) => {
  try {
    const { from, to } = dateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    const metrics = await adminService.getDashboardMetrics(from, to);
    sendSuccess(res, metrics);
  } catch (e) {
    next(e);
  }
});

router.get('/books', validateQuery(bookQuerySchema.extend({ admin: z.literal('true').optional() })), async (req, res, next) => {
  req.query.admin = 'true';
  return bookController.listBooks(req, res, next);
});

router.get('/books/:id', async (req, res, next) => {
  try {
    const book = await getBookById(req.params.id, true);
    sendSuccess(res, book);
  } catch (e) {
    next(e);
  }
});

router.post(
  '/books',
  uploadBookImages.array('covers', 5),
  validateUploadedBookImages,
  validateBody(bookCreateSchema),
  bookController.createBook,
);

router.patch(
  '/books/:id',
  uploadBookImages.array('covers', 5),
  validateUploadedBookImages,
  validateBody(bookUpdateSchema),
  bookController.updateBook,
);

router.delete('/books/:id', bookController.deleteBook);

const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.get('/categories', async (_req, res, next) => {
  try {
    sendSuccess(res, await Category.find().sort({ name: 1 }));
  } catch (e) {
    next(e);
  }
});

router.post('/categories', validateBody(categorySchema), async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const cat = await Category.create({ ...req.body, slug });
    sendSuccess(res, cat, 201);
  } catch (e) {
    next(e);
  }
});

router.patch('/categories/:id', validateBody(categorySchema.partial()), async (req, res, next) => {
  try {
    const cat = await Category.findById(routeParam(req.params.id));
    if (!cat) throw new NotFoundError('Category not found');
    if (req.body.name !== undefined) {
      cat.name = req.body.name;
      cat.slug = slugify(req.body.name, { lower: true, strict: true });
    }
    if (req.body.description !== undefined) cat.description = req.body.description;
    if (req.body.isActive !== undefined) cat.isActive = req.body.isActive;
    await cat.save();
    sendSuccess(res, cat);
  } catch (e) {
    next(e);
  }
});

const authorSchema = z.object({
  name: z.string().trim().min(1).max(160),
  bio: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.get('/authors', async (_req, res, next) => {
  try {
    sendSuccess(res, await Author.find().sort({ name: 1 }));
  } catch (e) {
    next(e);
  }
});

router.post('/authors', validateBody(authorSchema), async (req, res, next) => {
  try {
    const slug = slugify(req.body.name, { lower: true, strict: true });
    const author = await Author.create({ ...req.body, slug });
    sendSuccess(res, author, 201);
  } catch (e) {
    next(e);
  }
});

router.patch('/authors/:id', validateBody(authorSchema.partial()), async (req, res, next) => {
  try {
    const author = await Author.findById(routeParam(req.params.id));
    if (!author) throw new NotFoundError('Author not found');
    if (req.body.name !== undefined) {
      author.name = req.body.name;
      author.slug = slugify(req.body.name, { lower: true, strict: true });
    }
    if (req.body.bio !== undefined) author.bio = req.body.bio;
    if (req.body.isActive !== undefined) author.isActive = req.body.isActive;
    await author.save();
    sendSuccess(res, author);
  } catch (e) {
    next(e);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email'),
      Order.countDocuments(),
    ]);
    sendSuccess(res, items, 200, { page, limit, total });
  } catch (e) {
    next(e);
  }
});

const orderStatusSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
});

router.patch('/orders/:id/status', validateBody(orderStatusSchema), async (req, res, next) => {
  try {
    const status: OrderStatus = req.body.status;
    const order = await orderService.updateOrderStatus(routeParam(req.params.id), status);
    sendSuccess(res, order);
  } catch (e) {
    next(e);
  }
});

router.get('/customers', async (_req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('name email role createdAt isActive');
    sendSuccess(res, users);
  } catch (e) {
    next(e);
  }
});

const roleSchema = z.object({ role: z.enum(['customer', 'admin']) });

router.patch('/users/:id/role', validateBody(roleSchema), async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user!;
    const role: 'customer' | 'admin' = req.body.role;
    const targetUserId = routeParam(req.params.id);
    const target = await User.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    if (String(target._id) === String(user._id) && role !== 'admin') {
      throw new AppError('You cannot remove your own administrator access', 409, 'SELF_DEMOTION_NOT_ALLOWED');
    }
    if (target.role === 'admin' && role === 'customer' && (await User.countDocuments({ role: 'admin' })) <= 1) {
      throw new AppError('The last administrator cannot be demoted', 409, 'LAST_ADMIN_REQUIRED');
    }
    target.role = role;
    await target.save();
    const updated = target;
    await logAudit({
      actorId: user._id,
      action: 'user.role_change',
      resourceType: 'User',
      resourceId: targetUserId,
      ip: req.ip,
      metadata: { role },
    });
    sendSuccess(res, updated);
  } catch (e) {
    next(e);
  }
});

router.get('/reviews', async (_req, res, next) => {
  try {
    const reviews = await Review.find({ status: 'pending' }).populate('user book');
    sendSuccess(res, reviews);
  } catch (e) {
    next(e);
  }
});

const reviewStatusSchema = z.object({ status: z.enum(['approved', 'rejected']) });

router.patch('/reviews/:id', validateBody(reviewStatusSchema), async (req, res, next) => {
  try {
    const review = await Review.findByIdAndUpdate(
      routeParam(req.params.id),
      { status: req.body.status },
      { new: true, runValidators: true },
    );
    if (!review) throw new NotFoundError('Review not found');
    sendSuccess(res, review);
  } catch (e) {
    next(e);
  }
});

router.get('/coupons', async (_req, res, next) => {
  try {
    sendSuccess(res, await Coupon.find().sort({ createdAt: -1 }));
  } catch (e) {
    next(e);
  }
});

const couponFields = z.object({
  code: z.string().trim().min(3).max(40),
  description: z.string().optional(),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().min(0).default(0),
  maxUses: z.coerce.number().int().min(1).default(100),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});
const couponSchema = couponFields.refine((coupon) => coupon.discountType !== 'percent' || coupon.discountValue <= 100, {
  message: 'Percentage discounts cannot exceed 100%',
  path: ['discountValue'],
});
const couponUpdateSchema = couponFields.partial().refine(
  (coupon) => coupon.discountType !== 'percent' || coupon.discountValue === undefined || coupon.discountValue <= 100,
  { message: 'Percentage discounts cannot exceed 100%', path: ['discountValue'] },
);

router.post('/coupons', validateBody(couponSchema), async (req, res, next) => {
  try {
    const coupon = await Coupon.create({ ...req.body, code: req.body.code.toUpperCase() });
    sendSuccess(res, coupon, 201);
  } catch (e) {
    next(e);
  }
});

router.patch('/coupons/:id', validateBody(couponUpdateSchema), async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(routeParam(req.params.id));
    if (!coupon) throw new NotFoundError('Coupon not found');
    if (req.body.maxUses !== undefined && req.body.maxUses < coupon.usedCount) {
      throw new AppError('Maximum uses cannot be lower than the number already used', 422, 'COUPON_MAX_USES_TOO_LOW');
    }
    const discountType = req.body.discountType ?? coupon.discountType;
    const discountValue = req.body.discountValue ?? coupon.discountValue;
    if (discountType === 'percent' && discountValue > 100) {
      throw new AppError('Percentage discounts cannot exceed 100%', 422, 'INVALID_DISCOUNT_VALUE');
    }
    Object.assign(coupon, req.body);
    if (req.body.code !== undefined) coupon.code = req.body.code.toUpperCase();
    await coupon.save();
    sendSuccess(res, coupon);
  } catch (e) {
    next(e);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const bookId = req.query.bookId as string | undefined;
    const filter = bookId ? { book: bookId } : {};
    const items = await InventoryTransaction.find(filter).sort({ createdAt: -1 }).limit(100);
    sendSuccess(res, items);
  } catch (e) {
    next(e);
  }
});

router.get('/reports/sales.csv', validateQuery(reportDateSchema), async (req, res, next) => {
  try {
    const { from, to } = dateRange({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    const csv = await adminService.exportSalesCsv(from, to);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const result = await adminService.listAuditLogs(page);
    sendSuccess(res, result.items, 200, { total: result.total, page });
  } catch (e) {
    next(e);
  }
});

export default router;
