import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cloudinaryMocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: cloudinaryMocks.config,
    uploader: {
      upload_stream: cloudinaryMocks.uploadStream,
      destroy: cloudinaryMocks.destroy,
    },
  },
}));

import { env } from '../config/env.js';
import { deleteCloudinaryAsset, uploadBookImage } from '../services/cloudinaryService.js';

describe('Cloudinary asset service', () => {
  beforeEach(() => {
    env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    env.CLOUDINARY_API_KEY = 'test-key';
    env.CLOUDINARY_API_SECRET = 'test-secret';
    cloudinaryMocks.config.mockClear();
    cloudinaryMocks.destroy.mockReset();
    cloudinaryMocks.uploadStream.mockReset();
  });

  afterEach(() => {
    env.CLOUDINARY_CLOUD_NAME = undefined;
    env.CLOUDINARY_API_KEY = undefined;
    env.CLOUDINARY_API_SECRET = undefined;
  });

  it('uploads buffered image data to the books folder and returns metadata', async () => {
    cloudinaryMocks.uploadStream.mockImplementation((_options, callback) => {
      const stream = new Writable({ write(_chunk, _encoding, done) { done(); } });
      queueMicrotask(() => callback(null, {
        public_id: 'books-bin/books/book-id',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/book-id.webp',
        resource_type: 'image',
        format: 'webp',
        width: 800,
        height: 1200,
      }));
      return stream;
    });

    await expect(uploadBookImage(Buffer.from('image bytes'))).resolves.toEqual({
      publicId: 'books-bin/books/book-id',
      secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/book-id.webp',
      resourceType: 'image',
      format: 'webp',
      width: 800,
      height: 1200,
    });
    expect(cloudinaryMocks.config).toHaveBeenCalledWith(expect.objectContaining({
      cloud_name: 'test-cloud',
      api_key: 'test-key',
      secure: true,
    }));
    expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'books-bin/books', resource_type: 'image' }),
      expect.any(Function),
    );
  });

  it('returns a clear configuration error when credentials are missing', async () => {
    env.CLOUDINARY_API_SECRET = undefined;

    await expect(uploadBookImage(Buffer.from('image bytes'))).rejects.toMatchObject({
      statusCode: 503,
      code: 'CLOUDINARY_NOT_CONFIGURED',
    });
    expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
  });

  it('deletes only the requested Cloudinary asset resource', async () => {
    cloudinaryMocks.destroy.mockResolvedValue({ result: 'ok' });

    await deleteCloudinaryAsset({ publicId: 'books-bin/books/book-id', resourceType: 'image' });

    expect(cloudinaryMocks.destroy).toHaveBeenCalledWith('books-bin/books/book-id', {
      resource_type: 'image',
      invalidate: true,
    });
  });
});
