import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { cloudinaryAssetSchema, type CloudinaryAsset } from './CloudinaryAsset.js';

export interface IBook extends Document {
  title: string;
  slug: string;
  isbn: string;
  description: string;
  category: Types.ObjectId;
  author: Types.ObjectId;
  publisher?: string;
  publishedAt?: Date;
  price: number;
  discountPercent: number;
  stock: number;
  coverImages: string[];
  coverAssets: CloudinaryAsset[];
  featured: boolean;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    isbn: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'Author', required: true, index: true },
    publisher: { type: String, trim: true },
    publishedAt: { type: Date },
    price: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, min: 0, index: true },
    coverImages: { type: [String], default: [] },
    coverAssets: { type: [cloudinaryAssetSchema], default: [] },
    featured: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

bookSchema.index({ price: 1 });
bookSchema.index({ createdAt: -1 });
bookSchema.index({ title: 'text', description: 'text' });

export function bookEffectivePrice(book: Pick<IBook, 'price' | 'discountPercent'>): number {
  const discount = (book.price * book.discountPercent) / 100;
  return Math.round((book.price - discount) * 100) / 100;
}

export const Book = mongoose.model<IBook>('Book', bookSchema);
