import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IWishlist extends Document {
  user: Types.ObjectId;
  books: Types.ObjectId[];
  updatedAt: Date;
  createdAt: Date;
}

const wishlistSchema = new Schema<IWishlist>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    books: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
  },
  { timestamps: true },
);

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
