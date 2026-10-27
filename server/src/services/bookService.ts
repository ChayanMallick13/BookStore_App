import slugify from 'slugify';
import mongoose from 'mongoose';
import { Book, bookEffectivePrice, type IBook } from '../models/Book.js';
import { NotFoundError, ConflictError, AppError } from '../utils/errors.js';
import { paginationMeta, type PaginationInput } from '../utils/pagination.js';
import { InventoryTransaction } from '../models/InventoryTransaction.js';
import { Order } from '../models/Order.js';
import type { z } from 'zod';
import type { bookCreateSchema, bookQuerySchema } from '../validators/bookValidators.js';
import type { CloudinaryAsset } from '../models/CloudinaryAsset.js';
import { deleteUnreferencedCloudinaryAssets } from './cloudinaryCleanupService.js';

type BookCreate = z.infer<typeof bookCreateSchema>;
type BookQuery = z.infer<typeof bookQuerySchema>;

export function serializeBook(book: IBook & { category?: unknown; author?: unknown }) {
  const effectivePrice = bookEffectivePrice(book);
  return {
    id: book._id,
    title: book.title,
    slug: book.slug,
    isbn: book.isbn,
    description: book.description,
    category: book.category,
    author: book.author,
    publisher: book.publisher,
    publishedAt: book.publishedAt,
    price: book.price,
    discountPercent: book.discountPercent,
    effectivePrice,
    stock: book.stock,
    inStock: book.stock > 0,
    coverImages: book.coverImages,
    coverAssets: book.coverAssets ?? [],
    featured: book.featured,
    isActive: book.isActive,
    isArchived: book.isArchived,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base, { lower: true, strict: true });
  let i = 0;
  while (true) {
    const candidate = i ? `${slug}-${i}` : slug;
    const exists = await Book.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!exists) return candidate;
    i += 1;
  }
}

export async function listBooks(query: BookQuery) {
  const filter: Record<string, unknown> = {};
  if (!query.admin) {
    filter.isActive = true;
    filter.isArchived = false;
  }
  if (query.q) {
    filter.$text = { $search: query.q };
  }
  if (query.category) {
    filter.category = mongoose.isValidObjectId(query.category)
      ? query.category
      : undefined;
  }
  if (query.author) {
    filter.author = mongoose.isValidObjectId(query.author) ? query.author : undefined;
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
  }
  if (query.inStock) filter.stock = { $gt: 0 };
  if (query.featured) filter.featured = true;

  const sortField = query.sort;
  const sortOrder = query.order === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    Book.find(filter)
      .sort(query.q ? { score: { $meta: 'textScore' } } : { [sortField]: sortOrder })
      .skip(skip)
      .limit(query.limit)
      .populate('category', 'name slug')
      .populate('author', 'name slug'),
    Book.countDocuments(filter),
  ]);

  return {
    items: items.map((b) => serializeBook(b as IBook)),
    meta: paginationMeta(total, query as PaginationInput),
  };
}

export async function getBookBySlug(slug: string) {
  const book = await Book.findOne({ slug, isActive: true, isArchived: false })
    .populate('category', 'name slug')
    .populate('author', 'name slug bio');
  if (!book) throw new NotFoundError('Book not found');
  return serializeBook(book);
}

export async function getBookById(id: string, admin = false) {
  const filter = admin ? { _id: id } : { _id: id, isActive: true, isArchived: false };
  const book = await Book.findOne(filter)
    .populate('category', 'name slug')
    .populate('author', 'name slug');
  if (!book) throw new NotFoundError('Book not found');
  return serializeBook(book);
}

export async function createBook(input: BookCreate, coverAssets: CloudinaryAsset[], actorId?: string) {
  const slug = await uniqueSlug(input.title);
  try {
    const book = await Book.create({
      ...input,
      slug,
      coverImages: coverAssets.map((asset) => asset.secureUrl),
      coverAssets,
    });
    if (actorId) {
      await InventoryTransaction.create({
        book: book._id,
        change: input.stock,
        reason: 'Initial stock',
        referenceType: 'admin',
        performedBy: actorId,
        stockAfter: input.stock,
      });
    }
    return serializeBook(await book.populate(['category', 'author']));
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) throw new ConflictError('ISBN or slug already exists');
    throw e;
  }
}

export async function updateBook(
  id: string,
  input: Partial<BookCreate>,
  coverAssets?: CloudinaryAsset[],
  actorId?: string,
) {
  const book = await Book.findById(id);
  if (!book) throw new NotFoundError('Book not found');
  const previousAssets = book.coverAssets ?? [];
  const prevStock = book.stock;
  if (input.title) book.slug = await uniqueSlug(input.title, id);
  Object.assign(book, input);
  if (coverAssets?.length) {
    book.coverAssets = coverAssets;
    book.coverImages = coverAssets.map((asset) => asset.secureUrl);
  }
  await book.save();
  if (coverAssets?.length) await deleteUnreferencedCloudinaryAssets(previousAssets);
  if (input.stock !== undefined && input.stock !== prevStock && actorId) {
    await InventoryTransaction.create({
      book: book._id,
      change: input.stock - prevStock,
      reason: 'Admin inventory adjustment',
      referenceType: 'admin',
      performedBy: actorId,
      stockAfter: book.stock,
    });
  }
  return serializeBook(await book.populate(['category', 'author']));
}

export async function deleteBook(id: string) {
  const hasOrders = await Order.exists({ 'items.bookId': id });
  if (hasOrders) {
    const book = await Book.findByIdAndUpdate(id, { isArchived: true, isActive: false }, { new: true });
    if (!book) throw new NotFoundError('Book not found');
    return { archived: true, book: serializeBook(book) };
  }
  const book = await Book.findByIdAndDelete(id);
  if (!book) throw new NotFoundError('Book not found');
  await deleteUnreferencedCloudinaryAssets(book.coverAssets ?? []);
  return { archived: false, book: serializeBook(book) };
}

export async function adjustStockAtomic(
  session: mongoose.ClientSession,
  bookId: string,
  quantity: number,
  meta: { reason: string; referenceType: 'order' | 'cancellation' | 'payment_failure'; referenceId?: string },
) {
  const updated = await Book.findOneAndUpdate(
    { _id: bookId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true, session },
  );
  if (!updated) throw new AppError('Insufficient stock', 409, 'INSUFFICIENT_STOCK');
  await InventoryTransaction.create(
    [
      {
        book: bookId,
        change: -quantity,
        reason: meta.reason,
        referenceType: meta.referenceType,
        referenceId: meta.referenceId,
        stockAfter: updated.stock,
      },
    ],
    { session },
  );
  return updated;
}

export async function restoreStockAtomic(
  session: mongoose.ClientSession,
  bookId: string,
  quantity: number,
  meta: { reason: string; referenceType: 'cancellation' | 'payment_failure'; referenceId?: string },
) {
  const updated = await Book.findOneAndUpdate(
    { _id: bookId },
    { $inc: { stock: quantity } },
    { new: true, session },
  );
  if (!updated) throw new NotFoundError('Book not found');
  await InventoryTransaction.create(
    [
      {
        book: bookId,
        change: quantity,
        reason: meta.reason,
        referenceType: meta.referenceType,
        referenceId: meta.referenceId,
        stockAfter: updated.stock,
      },
    ],
    { session },
  );
}
