import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IInventoryTransaction extends Document {
  book: Types.ObjectId;
  change: number;
  reason: string;
  referenceType?: 'order' | 'admin' | 'cancellation' | 'payment_failure';
  referenceId?: Types.ObjectId;
  performedBy?: Types.ObjectId;
  stockAfter: number;
  createdAt: Date;
}

const inventorySchema = new Schema<IInventoryTransaction>(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    change: { type: Number, required: true },
    reason: { type: String, required: true },
    referenceType: { type: String, enum: ['order', 'admin', 'cancellation', 'payment_failure'] },
    referenceId: { type: Schema.Types.ObjectId },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    stockAfter: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inventorySchema.index({ createdAt: -1 });

export const InventoryTransaction = mongoose.model<IInventoryTransaction>(
  'InventoryTransaction',
  inventorySchema,
);
