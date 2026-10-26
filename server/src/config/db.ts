import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  await initializeModelIndexes();
  logger.info('MongoDB connected');
}

export async function initializeModelIndexes(): Promise<void> {
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
