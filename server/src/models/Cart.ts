import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICartItem {
  book: Types.ObjectId;
  quantity: number;
}

export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  updatedAt: Date;
  createdAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    quantity: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false },
);

const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export const Cart = mongoose.model<ICart>('Cart', cartSchema);
