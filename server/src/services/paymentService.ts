import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { restoreStockAtomic } from './bookService.js';
import mongoose from 'mongoose';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { logger } from '../utils/logger.js';

function getRazorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay is not configured', 503, 'PAYMENT_NOT_CONFIGURED');
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
  if (!/^[\da-f]{64}$/i.test(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  if (!/^[\da-f]{64}$/i.test(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

export async function createRazorpayOrder(userId: string, orderId: string) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw new NotFoundError('Order not found');
  if (order.paymentMethod !== 'razorpay') throw new AppError('Invalid payment method', 422);
  if (order.paymentStatus === 'paid') throw new AppError('Order already paid', 409);
  if (order.status !== 'pending_payment') throw new AppError('Order is no longer payable', 409);

  const rzp = getRazorpay();
  const amountPaise = Math.round(order.total * 100);
  const rzpOrder = await rzp.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: order.orderNumber,
    notes: { orderId: String(order._id) },
  });

  order.razorpayOrderId = rzpOrder.id;
  await order.save();

  await Payment.create({
    order: order._id,
    user: userId,
    provider: 'razorpay',
    amount: order.total,
    status: 'created',
    razorpayOrderId: rzpOrder.id,
  });

  return {
    razorpayOrderId: rzpOrder.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: env.RAZORPAY_KEY_ID,
  };
}

export async function confirmRazorpayPayment(input: {
  userId: string;
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const order = await Order.findOne({ _id: input.orderId, user: input.userId });
  if (!order) throw new NotFoundError('Order not found');
  if (order.status !== 'pending_payment') throw new AppError('Order is no longer payable', 409);
  if (order.razorpayOrderId !== input.razorpayOrderId) {
    throw new AppError('Payment order mismatch', 422);
  }
  if (order.paymentStatus === 'paid') return order;
  const payment = await Payment.findOne({
    order: order._id,
    provider: 'razorpay',
    razorpayOrderId: input.razorpayOrderId,
  });
  if (!payment || Math.round(payment.amount * 100) !== Math.round(order.total * 100)) {
    throw new AppError('Payment record does not match the order', 409, 'PAYMENT_ORDER_MISMATCH');
  }

  const valid = verifyRazorpaySignature(
    input.razorpayOrderId,
    input.razorpayPaymentId,
    input.razorpaySignature,
  );
  if (!valid) throw new AppError('Invalid payment signature', 400, 'INVALID_SIGNATURE');
  if (Math.round(order.total * 100) <= 0) {
    throw new AppError('Invalid order amount', 422, 'INVALID_PAYMENT_AMOUNT');
  }

  order.paymentStatus = 'paid';
  order.status = 'paid';
  order.paidAt = new Date();
  await order.save();

  await Payment.findOneAndUpdate(
    { razorpayOrderId: input.razorpayOrderId },
    {
      status: 'captured',
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
    },
  );
  return order;
}

export async function handlePaymentFailed(orderId: string) {
  const order = await Order.findById(orderId);
  if (
    !order ||
    order.paymentStatus === 'paid' ||
    order.paymentStatus === 'failed' ||
    order.status === 'cancelled'
  ) {
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    for (const item of order.items) {
      await restoreStockAtomic(session, String(item.bookId), item.quantity, {
        reason: 'Payment failed',
        referenceType: 'payment_failure',
        referenceId: String(order._id),
      });
    }
    order.status = 'cancelled';
    order.paymentStatus = 'failed';
    order.cancelledAt = new Date();
    await order.save({ session });
    await session.commitTransaction();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function processWebhookEvent(eventId: string, payload: Record<string, unknown>) {
  const event = typeof payload.event === 'string' ? payload.event : 'unknown';
  let record;
  try {
    record = await WebhookEvent.create({ eventId, event, status: 'processing' });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const previous = await WebhookEvent.findOne({ eventId });
    if (previous?.status !== 'failed') return { duplicate: true };
    record = await WebhookEvent.findOneAndUpdate(
      { _id: previous._id, status: 'failed' },
      { $set: { event, status: 'processing' }, $inc: { attempts: 1 } },
      { new: true },
    );
    if (!record) return { duplicate: true };
  }

  try {
    const paymentPayload = payload.payload as { payment?: { entity?: Record<string, unknown> } } | undefined;
    const entity = paymentPayload?.payment?.entity;
    if (!entity || typeof entity.order_id !== 'string') {
      record.status = 'processed';
      record.processedAt = new Date();
      await record.save();
      return { handled: false };
    }

    const order = await Order.findOne({ razorpayOrderId: entity.order_id });
    if (!order) {
      record.status = 'processed';
      record.processedAt = new Date();
      await record.save();
      return { handled: false };
    }
    record.order = order._id;

    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (event === 'payment.captured') {
      const amount = Number(entity.amount);
      if (amount !== Math.round(order.total * 100) || entity.currency !== 'INR') {
        throw new AppError('Payment amount does not match the order', 409, 'PAYMENT_AMOUNT_MISMATCH');
      }
      if (order.status === 'cancelled' || order.status === 'refunded') {
        logger.error('Captured payment received for a non-payable order', {
          eventId,
          orderId: String(order._id),
        });
        record.status = 'processed';
        record.processedAt = new Date();
        await record.save();
        return { handled: false, reason: 'order_not_payable' };
      }
      if (order.paymentStatus !== 'paid') {
        order.paymentStatus = 'paid';
        order.status = 'paid';
        order.paidAt = new Date();
        await order.save();
      }
      if (payment) {
        payment.status = 'captured';
        if (typeof entity.id === 'string') payment.razorpayPaymentId = entity.id;
        await payment.save();
      }
    } else if (event === 'payment.failed') {
      if (order.paymentStatus !== 'paid') {
        await handlePaymentFailed(String(order._id));
        if (payment) {
          payment.status = 'failed';
          if (typeof entity.id === 'string') payment.razorpayPaymentId = entity.id;
          await payment.save();
        }
      }
    }

    record.status = 'processed';
    record.processedAt = new Date();
    await record.save();
    return { handled: event === 'payment.captured' || event === 'payment.failed' };
  } catch (error) {
    record.status = 'failed';
    await record.save();
    throw error;
  }
}
