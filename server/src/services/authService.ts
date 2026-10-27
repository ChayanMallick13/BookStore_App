import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError, ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, type RefreshTokenPayload } from '../utils/jwt.js';
import { sendEmail } from './emailService.js';
import { Cart } from '../models/Cart.js';
import { Wishlist } from '../models/Wishlist.js';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashEmailOtp(email: string, otp: string) {
  return crypto
    .createHmac('sha256', env.JWT_REFRESH_SECRET)
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest('hex');
}

async function emailVerificationOtp(email: string, otp: string) {
  await sendEmail(
    {
      to: email,
      subject: 'Your Books Bin verification code',
      html: `<p>Your Books Bin verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    },
  );
}

async function issueEmailVerificationOtp(user: InstanceType<typeof User>) {
  const otp = crypto.randomInt(100_000, 1_000_000).toString();
  user.emailVerificationOtp = hashEmailOtp(user.email, otp);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_OTP_TTL_MS);
  user.emailVerificationSentAt = new Date();
  user.emailVerificationAttempts = 0;
  await user.save();
  await emailVerificationOtp(user.email, otp);
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const existing = await User.findOne({ email });
  if (existing) throw new ConflictError('Email already registered');
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({
      name: input.name,
      email,
      passwordHash,
      role: 'customer',
      emailVerified: false,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ConflictError('Email already registered');
    throw error;
  }
  await issueEmailVerificationOtp(user);
  return { email: user.email };
}

export async function resendEmailVerificationOtp(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const user = await User.findOne({ email }).select(
    '+emailVerificationOtp +emailVerificationExpires +emailVerificationSentAt +emailVerificationAttempts',
  );
  if (!user || user.emailVerified) {
    throw new AppError('No unverified account found for this email', 404, 'VERIFICATION_NOT_FOUND');
  }
  const waitMs = user.emailVerificationSentAt
    ? EMAIL_OTP_RESEND_COOLDOWN_MS - (Date.now() - user.emailVerificationSentAt.getTime())
    : 0;
  if (waitMs > 0) {
    throw new AppError(
      `Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting another code`,
      429,
      'OTP_RESEND_COOLDOWN',
    );
  }
  await issueEmailVerificationOtp(user);
  return { email: user.email };
}

export async function verifyEmailOtp(emailInput: string, otp: string) {
  const email = normalizeEmail(emailInput);
  const user = await User.findOne({ email, emailVerified: false }).select(
    '+emailVerificationOtp +emailVerificationExpires +emailVerificationAttempts',
  );
  if (!user) throw new AppError('Invalid or expired verification code', 422, 'INVALID_EMAIL_OTP');
  if (user.emailVerificationAttempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    throw new AppError('Too many incorrect codes. Request a new verification code.', 429, 'OTP_ATTEMPTS_EXCEEDED');
  }
  if (!user.emailVerificationOtp || !user.emailVerificationExpires || user.emailVerificationExpires <= new Date()) {
    throw new AppError('Verification code expired. Request a new code.', 422, 'EMAIL_OTP_EXPIRED');
  }

  const expected = Buffer.from(user.emailVerificationOtp, 'hex');
  const actual = Buffer.from(hashEmailOtp(email, otp), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    await User.updateOne(
      { _id: user._id, emailVerified: false, emailVerificationAttempts: { $lt: EMAIL_OTP_MAX_ATTEMPTS } },
      { $inc: { emailVerificationAttempts: 1 } },
    );
    throw new AppError('Invalid or expired verification code', 422, 'INVALID_EMAIL_OTP');
  }

  const verifiedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailVerified: false,
      emailVerificationOtp: user.emailVerificationOtp,
      emailVerificationExpires: { $gt: new Date() },
      emailVerificationAttempts: { $lt: EMAIL_OTP_MAX_ATTEMPTS },
    },
    {
      $set: { emailVerified: true },
      $unset: {
        emailVerificationOtp: 1,
        emailVerificationExpires: 1,
        emailVerificationSentAt: 1,
        emailVerificationAttempts: 1,
      },
    },
    { new: true },
  );
  if (!verifiedUser) throw new AppError('Invalid or expired verification code', 422, 'INVALID_EMAIL_OTP');

  await Promise.all([
    Cart.updateOne({ user: verifiedUser._id }, { $setOnInsert: { items: [] } }, { upsert: true }),
    Wishlist.updateOne({ user: verifiedUser._id }, { $setOnInsert: { books: [] } }, { upsert: true }),
  ]);
  return issueTokens(verifiedUser._id.toString(), verifiedUser.role, verifiedUser.refreshTokenVersion);
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+passwordHash');
  if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');
  if (user.emailVerified === false) {
    throw new AppError('Verify your email before signing in', 403, 'EMAIL_NOT_VERIFIED');
  }
  return issueTokens(user._id.toString(), user.role, user.refreshTokenVersion);
}

export async function refreshSession(refreshToken: string) {
  let payload: RefreshTokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
  const user = await User.findOneAndUpdate(
    { _id: payload.sub, isActive: true, refreshTokenVersion: payload.version },
    { $inc: { refreshTokenVersion: 1 } },
    { new: true },
  );
  if (!user) throw new UnauthorizedError('Invalid refresh token');
  return issueTokens(user._id.toString(), user.role, user.refreshTokenVersion);
}

export async function logoutUser(userId: string) {
  await User.findByIdAndUpdate(userId, { $inc: { refreshTokenVersion: 1 } });
}

function issueTokens(userId: string, role: 'customer' | 'admin', version: number) {
  return {
    accessToken: signAccessToken(userId, role),
    refreshToken: signRefreshToken(userId, version),
    user: { id: userId, role },
  };
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user) return;
  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  await sendEmail(
    {
      to: user.email,
      subject: 'Reset your Books Bin password',
      html: `<p>Reset your password using this link. It expires in one hour.</p><p><a href="${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}">Reset password</a></p>`,
    },
  );
}

export async function resetPassword(token: string, newPassword: string) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires +passwordHash');
  if (!user) throw new NotFoundError('Invalid or expired reset token');
  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenVersion += 1;
  await user.save();
}

export function sanitizeUser(user: { _id: unknown; email: string; name: string; role: string }) {
  return { id: String(user._id), email: user.email, name: user.name, role: user.role };
}
