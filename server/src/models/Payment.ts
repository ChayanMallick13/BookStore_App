import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPayment extends Document {
  order: Types.ObjectId;
  user: Types.ObjectId;
  provider: 'razorpay' | 'cod';
  amount: number;
  currency: string;
  status: 'created' | 'pending' | 'captured' | 'failed' | 'cancelled';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  webhookEventId?: string;
  rawPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['razorpay', 'cod'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'pending', 'captured', 'failed', 'cancelled'],
      default: 'created',
      index: true,
    },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String, select: false },
    webhookEventId: { type: String, unique: true, sparse: true },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
