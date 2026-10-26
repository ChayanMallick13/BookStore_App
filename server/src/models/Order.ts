import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'razorpay' | 'cod';

export interface IOrderItemSnapshot {
  bookId: Types.ObjectId;
  title: string;
  isbn: string;
  coverImage?: string;
  unitPrice: number;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
}

export interface IShippingAddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItemSnapshot[];
  shippingAddress: IShippingAddressSnapshot;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  couponCode?: string;
  couponDiscount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  razorpayOrderId?: string;
  idempotencyKey?: string;
  notes?: string;
  cancelledAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItemSnapshot>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    title: { type: String, required: true },
    isbn: { type: String, required: true },
    coverImage: String,
    unitPrice: { type: Number, required: true },
    discountPercent: { type: Number, required: true },
    quantity: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false },
);

const shippingSchema = new Schema<IShippingAddressSnapshot>(
  {
    fullName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingSchema, required: true },
    subtotal: { type: Number, required: true },
    discountTotal: { type: Number, required: true },
    shippingFee: { type: Number, required: true },
    couponCode: String,
    couponDiscount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending_payment',
      index: true,
    },
    paymentMethod: { type: String, enum: ['razorpay', 'cod'], required: true },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    razorpayOrderId: { type: String, index: true, sparse: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    notes: String,
    cancelledAt: Date,
    paidAt: Date,
  },
  { timestamps: true },
);

orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};
