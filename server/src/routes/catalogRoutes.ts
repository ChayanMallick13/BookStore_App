import { Router } from 'express';
import { Category } from '../models/Category.js';
import { Author } from '../models/Author.js';
import { Book } from '../models/Book.js';
import { Order } from '../models/Order.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { NotFoundError } from '../utils/errors.js';
import * as bookService from '../services/bookService.js';

const router = Router();

router.get('/categories', async (_req, res, next) => {
  try {
    const items = await Category.find({ isActive: true }).sort({ name: 1 });
    sendSuccess(res, items);
  } catch (e) {
    next(e);
  }
});

router.get('/categories/:slug', async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) throw new NotFoundError('Category not found');
    const books = await Book.find({ category: category._id, isActive: true, isArchived: false })
      .populate('author', 'name slug')
      .sort({ createdAt: -1 })
      .limit(24);
    sendSuccess(res, { category, books: books.map((b) => bookService.serializeBook(b)) });
  } catch (e) {
    next(e);
  }
});

router.get('/authors', async (_req, res, next) => {
  try {
    const items = await Author.find({ isActive: true }).sort({ name: 1 });
    sendSuccess(res, items);
  } catch (e) {
    next(e);
  }
});

router.get('/authors/:slug', async (req, res, next) => {
  try {
    const author = await Author.findOne({ slug: req.params.slug, isActive: true });
    if (!author) throw new NotFoundError('Author not found');
    const books = await Book.find({ author: author._id, isActive: true, isArchived: false })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(24);
    sendSuccess(res, { author, books: books.map((b) => bookService.serializeBook(b)) });
  } catch (e) {
    next(e);
  }
});

router.get('/home', async (_req, res, next) => {
  try {
    const [featured, bestsellerIds, newArrivals] = await Promise.all([
      Book.find({ featured: true, isActive: true, isArchived: false })
        .populate('author category')
        .limit(8),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $unwind: '$items' },
        { $group: { _id: '$items.bookId', unitsSold: { $sum: '$items.quantity' } } },
        { $sort: { unitsSold: -1 } },
        { $limit: 8 },
      ]),
      Book.find({ isActive: true, isArchived: false }).sort({ createdAt: -1 }).populate('author category').limit(8),
    ]);
    const bestsellersById = await Book.find({
      _id: { $in: bestsellerIds.map((item) => item._id) },
      isActive: true,
      isArchived: false,
    }).populate('author category');
    const bestsellerOrder = new Map(bestsellerIds.map((item, index) => [String(item._id), index]));
    const bestsellers = bestsellersById.sort(
      (a, b) => (bestsellerOrder.get(String(a._id)) ?? 0) - (bestsellerOrder.get(String(b._id)) ?? 0),
    );
    sendSuccess(res, {
      featured: featured.map((b) => bookService.serializeBook(b)),
      bestsellers: bestsellers.map((b) => bookService.serializeBook(b)),
      newArrivals: newArrivals.map((b) => bookService.serializeBook(b)),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
