import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import type { CloudinaryAsset, CloudinaryResourceType } from '../models/CloudinaryAsset.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const UPLOAD_TIMEOUT_MS = 60_000;

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new AppError(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server.',
      503,
      'CLOUDINARY_NOT_CONFIGURED',
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadBookImage(
  buffer: Buffer,
  options: { publicId?: string } = {},
): Promise<CloudinaryAsset> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const fail = (error: unknown, timeoutFailure = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const errorCode = error && typeof error === 'object' && 'http_code' in error
        ? (error as { http_code?: unknown }).http_code
        : error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      logger.error(timeoutFailure ? 'Cloudinary image upload timed out' : 'Cloudinary image upload failed', {
        operation: 'cloudinary.asset.upload',
        provider: 'cloudinary',
        providerCode: typeof errorCode === 'string' || typeof errorCode === 'number' ? errorCode : undefined,
        errorName: error instanceof Error ? error.name : 'CloudinaryError',
      });
      reject(new AppError(
        timeoutFailure
          ? 'Cloudinary image upload timed out. Please try again.'
          : 'Image upload to Cloudinary failed. Check the Cloudinary configuration and try again.',
        timeoutFailure ? 504 : 502,
        timeoutFailure ? 'CLOUDINARY_TIMEOUT' : 'CLOUDINARY_UPLOAD_FAILED',
      ));
    };
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'books-bin/books',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        quality: 'auto',
        fetch_format: 'auto',
        transformation: [{ width: 1600, height: 2400, crop: 'limit' }],
        ...(options.publicId
          ? { public_id: options.publicId, overwrite: true, unique_filename: false }
          : {}),
      },
      (error, result) => {
        if (error || !result) {
          fail(error ?? new Error('Empty Cloudinary upload response'));
          return;
        }
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          resourceType: result.resource_type as CloudinaryResourceType,
          format: result.format,
          width: result.width,
          height: result.height,
        });
      },
    );
    timeout = setTimeout(() => {
      fail(new Error('Cloudinary upload timed out'), true);
      stream.destroy();
    }, UPLOAD_TIMEOUT_MS);
    stream.once('close', () => clearTimeout(timeout));
    stream.once('error', (error) => fail(error));
    Readable.from([buffer]).pipe(stream);
  });
}

export async function deleteCloudinaryAsset(asset: Pick<CloudinaryAsset, 'publicId' | 'resourceType'>) {
  configureCloudinary();
  const result = await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: asset.resourceType,
    invalidate: true,
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary deletion was not confirmed (${result.result})`);
  }
}
