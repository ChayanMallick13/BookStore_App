import type { RequestHandler } from 'express';
import { User, type IUser } from '../models/User.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';

export interface AuthRequest extends Express.Request {
  user?: IUser;
}

export const authenticate: RequestHandler = async (req, res, next) => {
  const token =
    req.cookies?.[ACCESS_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!token) return next(new UnauthorizedError());

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new UnauthorizedError());
  }

  try {
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedError();
    (req as AuthRequest).user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next();

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next();
  }

  try {
    const user = await User.findById(payload.sub);
    if (user?.isActive) (req as AuthRequest).user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export function requireRole(...roles: Array<'admin' | 'customer'>): RequestHandler {
  return (req, _res, next) => {
    const user = (req as AuthRequest).user;
    if (!user) return next(new UnauthorizedError());
    if (!roles.includes(user.role)) return next(new ForbiddenError());
    next();
  };
}
