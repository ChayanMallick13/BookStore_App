import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, getTestApp } from './helpers.js';
import { User } from '../models/User.js';

describe('Auth & authorization', () => {
  const app = getTestApp();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('registers and logs in a customer', async () => {
    vi.spyOn(crypto, 'randomInt').mockReturnValue(123456);
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'customer@test.com',
      password: 'password123',
    });
    expect(reg.status).toBe(202);
    expect(reg.body.success).toBe(true);
    expect(reg.body.data.requiresEmailVerification).toBe(true);
    expect(reg.headers['set-cookie']).toBeUndefined();

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@test.com',
      password: 'password123',
    });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const invalidCode = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'customer@test.com',
      otp: '000000',
    });
    expect(invalidCode.status).toBe(422);

    const verified = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'customer@test.com',
      otp: '123456',
    });
    expect(verified.status).toBe(200);
    expect(verified.headers['set-cookie']).toBeDefined();

    const replay = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'customer@test.com',
      otp: '123456',
    });
    expect(replay.status).toBe(422);

    const duplicate = await request(app).post('/api/v1/auth/register').send({
      name: 'Another User',
      email: 'CUSTOMER@test.com',
      password: 'password123',
    });
    expect(duplicate.status).toBe(409);

    vi.restoreAllMocks();
    const authenticatedLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@test.com',
      password: 'password123',
    });
    expect(authenticatedLogin.status).toBe(200);
  });

  it('denies customer access to admin books create', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@test.com',
      password: 'password123',
    });
    const cookie = login.headers['set-cookie'];
    const res = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', cookie)
      .field('title', 'Hack Book')
      .field('isbn', '9780000000001')
      .field('description', 'Should not be allowed for customers')
      .field('category', '507f1f77bcf86cd799439011')
      .field('author', '507f1f77bcf86cd799439011')
      .field('price', '100')
      .field('stock', '1');
    expect(res.status).toBe(403);
  });

  it('limits OTP guesses and rejects resending during the cooldown', async () => {
    vi.spyOn(crypto, 'randomInt').mockReturnValue(222333);
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'Pending Customer',
      email: 'pending@test.com',
      password: 'password123',
    });
    expect(registration.status).toBe(202);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post('/api/v1/auth/verify-email').send({
        email: 'pending@test.com',
        otp: '000000',
      });
      expect(response.status).toBe(422);
    }
    const locked = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'pending@test.com',
      otp: '222333',
    });
    expect(locked.status).toBe(429);

    const resend = await request(app).post('/api/v1/auth/resend-verification').send({
      email: 'pending@test.com',
    });
    expect(resend.status).toBe(429);
    vi.restoreAllMocks();
  });

  it('rotates refresh cookies and rejects replay of the previous token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'customer@test.com',
      password: 'password123',
    });
    const previousCookies = login.headers['set-cookie'];
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', previousCookies);
    expect(refresh.status).toBe(200);

    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', previousCookies);
    expect(replay.status).toBe(401);

    const nextRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refresh.headers['set-cookie']);
    expect(nextRefresh.status).toBe(200);
  });

  it('rejects refresh requests without a refresh cookie', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows admin to access admin dashboard', async () => {
    await User.create({
      email: 'admin@test.com',
      name: 'Admin',
      passwordHash: await bcrypt.hash('adminpass123', 12),
      role: 'admin',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'adminpass123',
    });
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Cookie', login.headers['set-cookie']);
    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBeDefined();
  });
});
