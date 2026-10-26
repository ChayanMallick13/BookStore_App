import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { initializeModelIndexes } from '../config/db.js';
import { createApp } from '../app.js';
import type { Express } from 'express';

let replSet: MongoMemoryReplSet;

export async function setupTestDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await initializeModelIndexes();
}

export async function teardownTestDb() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

export function getTestApp(): Express {
  return createApp();
}
