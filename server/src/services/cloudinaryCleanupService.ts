import type { CloudinaryAsset } from '../models/CloudinaryAsset.js';
import { CloudinaryCleanup } from '../models/CloudinaryCleanup.js';
import { Book } from '../models/Book.js';
import { logger } from '../utils/logger.js';
import { deleteCloudinaryAsset } from './cloudinaryService.js';

async function queueCleanup(asset: CloudinaryAsset, error: unknown) {
  try {
    await CloudinaryCleanup.updateOne(
      { publicId: asset.publicId },
      {
        $setOnInsert: {
          resourceType: asset.resourceType,
          attempts: 0,
          nextAttemptAt: new Date(),
        },
        $set: { lastError: error instanceof Error ? error.name : 'UnknownError' },
      },
      { upsert: true },
    );
  } catch (queueError) {
    logger.error('Cloudinary cleanup could not be queued', {
      operation: 'cloudinary.cleanup.queue',
      publicId: asset.publicId,
      errorName: queueError instanceof Error ? queueError.name : 'UnknownError',
    });
  }
}

export async function deleteUnreferencedCloudinaryAssets(assets: CloudinaryAsset[]) {
  const uniqueAssets = [...new Map(assets.map((asset) => [asset.publicId, asset])).values()];
  for (const asset of uniqueAssets) {
    if (await Book.exists({ 'coverAssets.publicId': asset.publicId })) continue;
    const assetRef = { publicId: asset.publicId, resourceType: asset.resourceType };
    try {
      await deleteCloudinaryAsset(assetRef);
      await CloudinaryCleanup.deleteOne({ publicId: asset.publicId });
    } catch (error) {
      logger.error('Cloudinary asset deletion failed; cleanup queued for retry', {
        operation: 'cloudinary.asset.delete',
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      await queueCleanup(asset, error);
    }
  }
}

export async function retryCloudinaryCleanup(limit = 100) {
  const due = await CloudinaryCleanup.find({ nextAttemptAt: { $lte: new Date() } })
    .sort({ nextAttemptAt: 1 })
    .limit(limit);
  let deleted = 0;
  let failed = 0;

  for (const item of due) {
    try {
      if (await Book.exists({ 'coverAssets.publicId': item.publicId })) {
        await item.deleteOne();
        continue;
      }
      await deleteCloudinaryAsset({ publicId: item.publicId, resourceType: item.resourceType });
      await item.deleteOne();
      deleted += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      const delayMs = Math.min(24 * 60 * 60 * 1000, 60_000 * (2 ** Math.min(attempts, 10)));
      item.attempts = attempts;
      item.nextAttemptAt = new Date(Date.now() + delayMs);
      item.lastError = error instanceof Error ? error.name : 'UnknownError';
      await item.save();
      failed += 1;
    }
  }

  return { processed: due.length, deleted, failed };
}
