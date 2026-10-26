import type { RequestHandler } from 'express';
import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../utils/cookies.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { AuthRequest } from '../middleware/auth.js';

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    sendSuccess(res, {
      email: result.email,
      message: 'A verification code has been sent to your email address.',
      requiresEmailVerification: true,
    }, 202);
  } catch (e) {
    next(e);
  }
};

export const verifyEmail: RequestHandler = async (req, res, next) => {
  try {
    const tokens = await authService.verifyEmailOtp(req.body.email, req.body.otp);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    sendSuccess(res, { user: tokens.user });
  } catch (e) {
    next(e);
  }
};

export const resendEmailVerification: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.resendEmailVerificationOtp(req.body.email);
    sendSuccess(res, {
      email: result.email,
      message: 'A new verification code has been sent.',
    });
  } catch (e) {
    next(e);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const tokens = await authService.loginUser(req.body.email, req.body.password);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    sendSuccess(res, { user: tokens.user });
  } catch (e) {
    next(e);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return next(new UnauthorizedError('No refresh token'));
    const tokens = await authService.refreshSession(token);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    sendSuccess(res, { user: tokens.user });
  } catch (e) {
    next(e);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as AuthRequest).user;
    if (user) await authService.logoutUser(String(user._id));
    clearAuthCookies(res);
    sendSuccess(res, { ok: true });
  } catch (e) {
    next(e);
  }
};

export const me: RequestHandler = async (req, res) => {
  const user = (req as AuthRequest).user!;
  sendSuccess(res, authService.sanitizeUser(user));
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.requestPasswordReset(req.body.email);
    sendSuccess(res, { message: 'If the email exists, reset instructions were sent.' });
  } catch (e) {
    next(e);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, { message: 'Password updated' });
  } catch (e) {
    next(e);
  }
};
