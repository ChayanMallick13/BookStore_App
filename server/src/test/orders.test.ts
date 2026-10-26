import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { setupTestDb, teardownTestDb, getTestApp } from './helpers.js';
import { Author } from '../models/Author.js';
import { Book } from '../models/Book.js';
import { Category } from '../models/Category.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Coupon } from '../models/Coupon.js';
import { processWebhookEvent } from '../services/paymentService.js';

describe('Order lifecycle', () => {
  const app = getTestApp();
  let cookie: string[];
  let bookId: string;
  let addressId: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const category = await Category.create({ name: 'Orders', slug: 'orders' });
    const author = await Author.create({ name: 'Order Author', slug: 'order-author' });
    const book = await Book.create({
      title: 'Order Test Book',
      slug: 'order-test-book',
      isbn: '9783333333333',
      description: 'A test title used to verify persisted checkout and order processing.',
      category: category._id,
      author: author._id,
      price: 300,
      discountPercent: 10,
      stock: 5,
    });
    bookId = String(book._id);

    vi.spyOn(crypto, 'randomInt').mockReturnValue(654321);
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Order Customer',
      email: 'orders@test.com',
      password: 'customerpass123',
    });
    expect(register.status).toBe(202);
    const verification = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'orders@test.com',
      otp: '654321',
    });
    expect(verification.status).toBe(200);
    cookie = verification.headers['set-cookie'];
    userId = verification.body.data.user.id;
    vi.restoreAllMocks();

    const address = await request(app)
      .post('/api/v1/users/addresses')
      .set('Cookie', cookie)
      .send({
        label: 'Home',
        fullName: 'Order Customer',
        phone: '9876543210',
        line1: '10 Book Street',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'India',
        isDefault: true,
      });
    expect(address.status).toBe(201);
    addressId = address.body.data._id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('creates idempotent COD orders as unpaid, then restores stock on cancellation', async () => {
    const addToCart = await request(app)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ bookId, quantity: 2 });
    expect(addToCart.status).toBe(200);
    expect(addToCart.body.data.total).toBe(589);

    const orderRequest = {
      addressId,
      paymentMethod: 'cod',
      idempotencyKey: 'orders-test-idempotency-key',
    };
    const created = await request(app).post('/api/v1/orders').set('Cookie', cookie).send(orderRequest);
    expect(created.status).toBe(201);
    expect(created.body.data.paymentStatus).toBe('pending');
    expect(created.body.data.total).toBe(589);
    const orderId = created.body.data._id;

    const duplicate = await request(app).post('/api/v1/orders').set('Cookie', cookie).send(orderRequest);
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.data._id).toBe(orderId);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Book.findById(bookId))?.stock).toBe(3);

    const cancelled = await request(app)
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set('Cookie', cookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect((await Book.findById(bookId))?.stock).toBe(5);

    await request(app).post('/api/v1/cart/items').set('Cookie', cookie).send({ bookId, quantity: 2 });
    const pending = await request(app).post('/api/v1/orders').set('Cookie', cookie).send({
      addressId,
      paymentMethod: 'razorpay',
      idempotencyKey: 'orders-test-razorpay-key',
    });
    expect(pending.status).toBe(201);
    const pendingOrder = await Order.findById(pending.body.data._id);
    expect(pendingOrder?.paymentStatus).toBe('pending');
    pendingOrder!.razorpayOrderId = 'rzp_order_test_1';
    await pendingOrder!.save();
    await Payment.create({
      order: pendingOrder!._id,
      user: userId,
      provider: 'razorpay',
      amount: pendingOrder!.total,
      status: 'created',
      razorpayOrderId: 'rzp_order_test_1',
    });

    const captured = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_1',
            order_id: 'rzp_order_test_1',
            amount: Math.round(pendingOrder!.total * 100),
            currency: 'INR',
          },
        },
      },
    };
    expect(await processWebhookEvent('evt_capture_1', captured)).toEqual({ handled: true });
    expect(await processWebhookEvent('evt_capture_1', captured)).toEqual({ duplicate: true });
    const paidOrder = await Order.findById(pendingOrder!._id);
    expect(paidOrder?.paymentStatus).toBe('paid');
    expect(paidOrder?.status).toBe('paid');

    await Coupon.create({
      code: 'ONCE',
      discountType: 'fixed',
      discountValue: 50,
      minOrderAmount: 0,
      maxUses: 1,
      usedCount: 0,
      isActive: true,
    });
    await request(app).post('/api/v1/cart/items').set('Cookie', cookie).send({ bookId, quantity: 1 });
    const discounted = await request(app).post('/api/v1/orders').set('Cookie', cookie).send({
      addressId,
      paymentMethod: 'cod',
      couponCode: 'ONCE',
      idempotencyKey: 'orders-test-coupon-first',
    });
    expect(discounted.status).toBe(201);
    expect(discounted.body.data.couponDiscount).toBe(50);
    expect((await Coupon.findOne({ code: 'ONCE' }))?.usedCount).toBe(1);

    await request(app).post('/api/v1/cart/items').set('Cookie', cookie).send({ bookId, quantity: 1 });
    const overLimit = await request(app).post('/api/v1/orders').set('Cookie', cookie).send({
      addressId,
      paymentMethod: 'cod',
      couponCode: 'ONCE',
      idempotencyKey: 'orders-test-coupon-second',
    });
    expect(overLimit.status).toBe(422);
    expect((await Coupon.findOne({ code: 'ONCE' }))?.usedCount).toBe(1);
  });
});
