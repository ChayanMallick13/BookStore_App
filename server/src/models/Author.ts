import mongoose, { Schema, type Document } from 'mongoose';

export interface IAuthor extends Document {
  name: string;
  slug: string;
  bio?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const authorSchema = new Schema<IAuthor>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    bio: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Author = mongoose.model<IAuthor>('Author', authorSchema);
