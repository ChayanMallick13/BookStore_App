import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyRazorpaySignature, verifyWebhookSignature } from '../services/paymentService.js';

describe('Payment verification', () => {
  it('verifies razorpay payment signature', () => {
    const orderId = 'order_123';
    const paymentId = 'pay_456';
    const body = `${orderId}|${paymentId}`;
    const signature = crypto.createHmac('sha256', 'test_secret').update(body).digest('hex');
    expect(verifyRazorpaySignature(orderId, paymentId, signature)).toBe(true);
    expect(verifyRazorpaySignature(orderId, paymentId, 'bad')).toBe(false);
  });

  it('verifies webhook signature with raw body', () => {
    const raw = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
    const signature = crypto.createHmac('sha256', 'whsec').update(raw).digest('hex');
    expect(verifyWebhookSignature(raw, signature)).toBe(true);
  });
});
