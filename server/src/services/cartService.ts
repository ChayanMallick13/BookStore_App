import mongoose from 'mongoose';
import { Cart, type ICart } from '../models/Cart.js';
import { Book, bookEffectivePrice } from '../models/Book.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

export async function getOrCreateCart(userId: string) {
  let cart: ICart | null = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  await cart.populate({
    path: 'items.book',
    select: 'title slug price discountPercent stock coverImages isActive isArchived',
  });
  return computeCart(cart);
}

async function computeCart(cart: ICart | null) {
  if (!cart) throw new NotFoundError('Cart not found');
  const validItems = [];
  let subtotal = 0;
  for (const item of cart.items) {
    const book = item.book as unknown as {
      _id: mongoose.Types.ObjectId;
      title: string;
      slug: string;
      price: number;
      discountPercent: number;
      stock: number;
      coverImages: string[];
      isActive: boolean;
      isArchived: boolean;
    } | null;
    if (!book || !book.isActive || book.isArchived) continue;
    const qty = Math.min(item.quantity, book.stock);
    if (qty <= 0) continue;
    const unit = bookEffectivePrice(book);
    const lineTotal = Math.round(unit * qty * 100) / 100;
    subtotal += lineTotal;
    validItems.push({
      bookId: book._id,
      title: book.title,
      slug: book.slug,
      quantity: qty,
      unitPrice: unit,
      lineTotal,
      stock: book.stock,
      coverImage: book.coverImages[0],
    });
  }
  if (validItems.length !== cart.items.length) {
    cart.items = validItems.map((i) => ({ book: i.bookId, quantity: i.quantity }));
    await cart.save();
  }
  const shippingFee = subtotal >= env.FREE_SHIPPING_THRESHOLD ? 0 : env.SHIPPING_FLAT_RATE;
  return {
    items: validItems,
    subtotal: Math.round(subtotal * 100) / 100,
    shippingFee,
    total: Math.round((subtotal + shippingFee) * 100) / 100,
    freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD,
  };
}

export async function addToCart(userId: string, bookId: string, quantity: number) {
  const book = await Book.findOne({ _id: bookId, isActive: true, isArchived: false });
  if (!book) throw new NotFoundError('Book not found');
  if (quantity < 1 || quantity > 99) throw new AppError('Invalid quantity', 422);
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  const idx = cart.items.findIndex((i) => String(i.book) === bookId);
  const newQty = idx >= 0 ? cart.items[idx].quantity + quantity : quantity;
  if (newQty > book.stock) throw new AppError('Not enough stock', 409, 'INSUFFICIENT_STOCK');
  if (idx >= 0) cart.items[idx].quantity = newQty;
  else cart.items.push({ book: new mongoose.Types.ObjectId(bookId), quantity });
  await cart.save();
  return getOrCreateCart(userId);
}

export async function updateCartItem(userId: string, bookId: string, quantity: number) {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new NotFoundError('Cart not found');
  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => String(i.book) !== bookId);
  } else {
    const book = await Book.findById(bookId);
    if (!book) throw new NotFoundError('Book not found');
    if (quantity > book.stock) throw new AppError('Not enough stock', 409);
    const idx = cart.items.findIndex((i) => String(i.book) === bookId);
    if (idx < 0) throw new NotFoundError('Item not in cart');
    cart.items[idx].quantity = quantity;
  }
  await cart.save();
  return getOrCreateCart(userId);
}

export async function clearCart(userId: string) {
  await clearCartItems(userId);
  return getOrCreateCart(userId);
}

export async function clearCartItems(userId: string, session?: mongoose.ClientSession) {
  const update = Cart.updateOne({ user: userId }, { $set: { items: [] } });
  if (session) update.session(session);
  await update;
}
