import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Model } from 'mongoose';
import type { IBook } from '../models/Book.js';
import type { CloudinaryAsset } from '../models/CloudinaryAsset.js';
import { uploadBookImage } from './cloudinaryService.js';
import { deleteUnreferencedCloudinaryAssets } from './cloudinaryCleanupService.js';

export interface ImageMigrationSummary {
  booksScanned: number;
  assetsMigrated: number;
  assetsPlanned: number;
  assetsSkipped: number;
  failures: number;
}

interface MigrationOptions {
  dryRun: boolean;
  uploadsDirectory?: string;
  upload?: (buffer: Buffer, publicId: string) => Promise<CloudinaryAsset>;
  onProgress?: (message: string) => void;
}

function localUploadPath(url: string, uploadsDirectory: string) {
  if (!url.startsWith('/uploads/books/')) return undefined;
  let filename: string;
  try {
    filename = decodeURIComponent(url.slice('/uploads/books/'.length).split(/[?#]/, 1)[0]);
  } catch {
    return undefined;
  }
  if (!filename || filename !== path.basename(filename)) return undefined;
  return path.join(uploadsDirectory, filename);
}

function isCloudinaryUrl(url: string) {
  try {
    return new URL(url).hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

async function retryUpload(buffer: Buffer, publicId: string, upload: NonNullable<MigrationOptions['upload']>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await upload(buffer, publicId);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function migrateBookImages(
  books: IBook[],
  options: MigrationOptions,
): Promise<ImageMigrationSummary> {
  const uploadsDirectory = path.resolve(options.uploadsDirectory ?? path.resolve('uploads/books'));
  const upload = options.upload ?? ((buffer, publicId) => uploadBookImage(buffer, { publicId }));
  const summary: ImageMigrationSummary = {
    booksScanned: books.length,
    assetsMigrated: 0,
    assetsPlanned: 0,
    assetsSkipped: 0,
    failures: 0,
  };

  for (const book of books) {
    const newImages = [...book.coverImages];
    const newAssets = [...(book.coverAssets ?? [])];
    const uploadedThisBook: CloudinaryAsset[] = [];
    let changed = false;

    for (let index = 0; index < book.coverImages.length; index += 1) {
      const currentUrl = book.coverImages[index];
      if (newAssets.some((asset) => asset.secureUrl === currentUrl) || isCloudinaryUrl(currentUrl)) {
        summary.assetsSkipped += 1;
        continue;
      }

      const localPath = localUploadPath(currentUrl, uploadsDirectory);
      if (!localPath) {
        summary.assetsSkipped += 1;
        continue;
      }

      try {
        const buffer = await readFile(localPath);
        const fingerprint = createHash('sha256').update(buffer).digest('hex').slice(0, 20);
        const publicId = `book-${book._id}-${fingerprint}`;
        if (options.dryRun) {
          summary.assetsPlanned += 1;
          options.onProgress?.(`Would migrate ${book._id} image ${index + 1}`);
          continue;
        }

        const asset = await retryUpload(buffer, publicId, upload);
        uploadedThisBook.push(asset);
        newImages[index] = asset.secureUrl;
        newAssets.push(asset);
        changed = true;
      } catch {
        summary.failures += 1;
        options.onProgress?.(`Failed to migrate ${book._id} image ${index + 1}`);
      }
    }

    if (changed) {
      try {
        book.coverImages = newImages;
        book.coverAssets = newAssets;
        await book.save();
        summary.assetsMigrated += uploadedThisBook.length;
        options.onProgress?.(`Migrated ${book._id}: ${uploadedThisBook.length} image(s)`);
      } catch {
        summary.failures += uploadedThisBook.length;
        await deleteUnreferencedCloudinaryAssets(uploadedThisBook);
        options.onProgress?.(`Failed to save migrated metadata for ${book._id}`);
      }
    }
  }
  return summary;
}

export async function loadBooksForImageMigration(bookModel: Model<IBook>) {
  return bookModel.find({ coverImages: { $exists: true, $ne: [] } });
}
