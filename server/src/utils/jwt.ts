import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../models/User.js';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  version: number;
  type: 'refresh';
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessTokenPayload = { sub: userId, role, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(userId: string, version: number): string {
  const payload: RefreshTokenPayload = { sub: userId, version, type: 'refresh' };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return decoded;
}
