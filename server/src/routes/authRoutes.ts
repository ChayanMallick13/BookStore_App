import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validateBody } from '../middleware/validate.js';
import {
  registerSchema,
  verifyEmailSchema,
  resendEmailVerificationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authValidators.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/verify-email', validateBody(verifyEmailSchema), authController.verifyEmail);
router.post('/resend-verification', validateBody(resendEmailVerificationSchema), authController.resendEmailVerification);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

export default router;
