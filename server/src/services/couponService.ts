import type { ClientSession } from 'mongoose';
import { Coupon } from '../models/Coupon.js';
import { AppError } from '../utils/errors.js';

export async function validateCoupon(code: string, subtotal: number, session?: ClientSession) {
  let couponQuery = Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (session) couponQuery = couponQuery.session(session);
  const coupon = await couponQuery;
  if (!coupon) throw new AppError('Invalid coupon', 422, 'INVALID_COUPON');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new AppError('Coupon expired', 422, 'COUPON_EXPIRED');
  }
  if (coupon.usedCount >= coupon.maxUses) {
    throw new AppError('Coupon usage limit reached', 422, 'COUPON_LIMIT');
  }
  if (subtotal < coupon.minOrderAmount) {
    throw new AppError(`Minimum order ₹${coupon.minOrderAmount} required`, 422, 'COUPON_MIN_ORDER');
  }
  let discount = 0;
  if (coupon.discountType === 'percent') {
    discount = (subtotal * coupon.discountValue) / 100;
  } else {
    discount = coupon.discountValue;
  }
  discount = Math.min(discount, subtotal);
  return { coupon, discount: Math.round(discount * 100) / 100 };
}

export async function incrementCouponUsage(code: string, session?: ClientSession) {
  let usageUpdate = Coupon.updateOne(
    {
      code: code.toUpperCase(),
      isActive: true,
      $expr: { $lt: ['$usedCount', '$maxUses'] },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    },
    { $inc: { usedCount: 1 } },
  );
  if (session) usageUpdate = usageUpdate.session(session);
  const result = await usageUpdate;
  if (!result.modifiedCount) {
    throw new AppError('Coupon usage limit reached or coupon expired', 409, 'COUPON_LIMIT');
  }
}
