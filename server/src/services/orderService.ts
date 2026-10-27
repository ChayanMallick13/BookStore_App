import mongoose from 'mongoose';
import crypto from 'crypto';
import { Order, ORDER_STATUS_TRANSITIONS, type OrderStatus } from '../models/Order.js';
import { Address } from '../models/Address.js';
import { getOrCreateCart, clearCartItems } from './cartService.js';
import { validateCoupon, incrementCouponUsage } from './couponService.js';
import { adjustStockAtomic, restoreStockAtomic } from './bookService.js';
import { env } from '../config/env.js';
import { AppError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { Book, bookEffectivePrice } from '../models/Book.js';
import { escapeEmailHtml, sendEmail } from './emailService.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

function generateOrderNumber() {
  return `BH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

export async function createOrderFromCart(input: {
  userId: string;
  addressId: string;
  paymentMethod: 'razorpay' | 'cod';
  couponCode?: string;
  idempotencyKey?: string;
}) {
  if (input.idempotencyKey) {
    const existing = await Order.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return existing;
  }
  if (input.paymentMethod === 'cod' && !env.COD_ENABLED) {
    throw new AppError('Cash on delivery is not available', 422);
  }

  const address = await Address.findOne({ _id: input.addressId, user: input.userId });
  if (!address) throw new NotFoundError('Address not found');

  const cart = await getOrCreateCart(input.userId);
  if (!cart.items.length) throw new AppError('Cart is empty', 422);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const itemSnapshots = [];
    let subtotal = 0;
    for (const item of cart.items) {
      const book = await Book.findById(item.bookId).session(session);
      if (!book || !book.isActive || book.isArchived) {
        throw new AppError(`Book unavailable: ${item.title}`, 409);
      }
      const unit = bookEffectivePrice(book);
      const lineTotal = Math.round(unit * item.quantity * 100) / 100;
      subtotal += lineTotal;
      itemSnapshots.push({
        bookId: book._id,
        title: book.title,
        isbn: book.isbn,
        coverImage: book.coverImages[0],
        unitPrice: book.price,
        discountPercent: book.discountPercent,
        quantity: item.quantity,
        lineTotal,
      });
      await adjustStockAtomic(session, String(book._id), item.quantity, {
        reason: 'Order reservation',
        referenceType: 'order',
      });
    }

    let couponDiscount = 0;
    let couponCode: string | undefined;
    if (input.couponCode) {
      const { coupon, discount } = await validateCoupon(input.couponCode, subtotal, session);
      couponDiscount = discount;
      couponCode = coupon.code;
    }

    const afterCoupon = subtotal - couponDiscount;
    const shippingFee = afterCoupon >= env.FREE_SHIPPING_THRESHOLD ? 0 : env.SHIPPING_FLAT_RATE;
    const total = Math.round((afterCoupon + shippingFee) * 100) / 100;

    const order = await Order.create(
      [
        {
          orderNumber: generateOrderNumber(),
          user: input.userId,
          items: itemSnapshots,
          shippingAddress: {
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country,
          },
          subtotal,
          discountTotal: itemSnapshots.reduce(
            (s, i) => s + (i.unitPrice * i.discountPercent) / 100 * i.quantity,
            0,
          ),
          shippingFee,
          couponCode,
          couponDiscount,
          total,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === 'cod' ? 'pending' : 'pending',
          status: input.paymentMethod === 'cod' ? 'processing' : 'pending_payment',
          idempotencyKey: input.idempotencyKey,
        },
      ],
      { session },
    );

    if (couponCode) await incrementCouponUsage(couponCode, session);
    await clearCartItems(input.userId, session);
    await session.commitTransaction();

    const created = order[0];
    try {
      const user = await User.findById(input.userId);
      if (user) {
        await sendEmail(
          {
            to: user.email,
            subject: `Order ${created.orderNumber} received`,
            html: `<p>Thank you ${escapeEmailHtml(user.name)}. Your order total is ₹${created.total}.</p>`,
          },
        );
      }
    } catch (error) {
      logger.warn('Order committed but confirmation email was not accepted', {
        operation: 'email.order_confirmation',
        orderId: String(created._id),
        errorCode:
          error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : 'EMAIL_DELIVERY_FAILED',
      });
    }
    return created;
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function cancelOrder(userId: string, orderId: string, isAdmin = false) {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  if (!isAdmin && String(order.user) !== userId) throw new ForbiddenError();
  if (!['pending_payment', 'paid', 'processing'].includes(order.status)) {
    throw new AppError('Order cannot be cancelled', 422);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const item of order.items) {
      await restoreStockAtomic(session, String(item.bookId), item.quantity, {
        reason: 'Order cancellation',
        referenceType: 'cancellation',
        referenceId: String(order._id),
      });
    }
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    if (order.paymentStatus === 'paid') order.paymentStatus = 'refunded';
    await order.save({ session });
    await session.commitTransaction();
    return order;
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await Order.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  const allowed = ORDER_STATUS_TRANSITIONS[order.status];
  if (!allowed.includes(status)) {
    throw new AppError(`Cannot transition from ${order.status} to ${status}`, 422);
  }
  if (status === 'paid' && order.paymentStatus !== 'paid') {
    throw new AppError('An unpaid order cannot be marked paid manually', 422, 'PAYMENT_NOT_CONFIRMED');
  }
  order.status = status;
  await order.save();
  return order;
}

export async function listUserOrders(userId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Order.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments({ user: userId }),
  ]);
  return { items, total, page, limit };
}
