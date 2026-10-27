import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import authRoutes from './authRoutes.js';
import bookRoutes from './bookRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import cartRoutes from './cartRoutes.js';
import orderRoutes from './orderRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import adminRoutes from './adminRoutes.js';
import userRoutes from './userRoutes.js';
import { sendError } from '../utils/apiResponse.js';

const router = Router();

router.get('/health', (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    data: { status: databaseConnected ? 'ok' : 'degraded', service: 'bookhaven-api' },
  });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1_000 : 30,
  standardHeaders: true,
  handler: (_req, res) => sendError(
    res,
    'Too many authentication attempts. Please try again later.',
    429,
    'RATE_LIMITED',
  ),
});

router.use('/auth', authLimiter, authRoutes);
router.use('/books', bookRoutes);
router.use('/catalog', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);

export default router;
