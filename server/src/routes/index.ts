import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authRoutes from './authRoutes.js';
import bookRoutes from './bookRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import cartRoutes from './cartRoutes.js';
import orderRoutes from './orderRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import adminRoutes from './adminRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'bookhaven-api' } });
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true });

router.use('/auth', authLimiter, authRoutes);
router.use('/books', bookRoutes);
router.use('/catalog', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);

export default router;
