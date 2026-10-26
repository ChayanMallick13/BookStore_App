import type { Response } from 'express';
import { env } from '../config/env.js';

const ACCESS_COOKIE = 'bookhaven_access';
const REFRESH_COOKIE = 'bookhaven_refresh';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const secure = env.NODE_ENV === 'production' || env.COOKIE_SECURE;
  const sameSite = env.COOKIE_SAME_SITE;
  const common = {
    httpOnly: true,
    secure,
    sameSite: sameSite as 'strict' | 'lax' | 'none',
    path: '/',
  };
  res.cookie(ACCESS_COOKIE, accessToken, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
