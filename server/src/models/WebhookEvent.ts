import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  event: string;
  status: 'processing' | 'processed' | 'failed';
  order?: Types.ObjectId;
  attempts: number;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    status: { type: String, enum: ['processing', 'processed', 'failed'], required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    attempts: { type: Number, default: 1 },
    processedAt: Date,
  },
  { timestamps: true },
);

export const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema);
