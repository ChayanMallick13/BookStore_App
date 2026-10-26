import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface IReview extends Document {
  user: Types.ObjectId;
  book: Types.ObjectId;
  rating: number;
  title?: string;
  body: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true },
    body: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ book: 1, user: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
