import type { Response } from 'express';
import { env } from '../config/env.js';

const ACCESS_COOKIE = 'bookhaven_access';
const REFRESH_COOKIE = 'bookhaven_refresh';

function authCookieOptions() {
  const secure = env.NODE_ENV === 'production' || env.COOKIE_SECURE;
  return {
    httpOnly: true,
    secure,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  } as const;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const common = authCookieOptions();
  res.cookie(ACCESS_COOKIE, accessToken, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookies(res: Response) {
  const common = authCookieOptions();
  res.clearCookie(ACCESS_COOKIE, common);
  res.clearCookie(REFRESH_COOKIE, common);
}

export { ACCESS_COOKIE, REFRESH_COOKIE };
