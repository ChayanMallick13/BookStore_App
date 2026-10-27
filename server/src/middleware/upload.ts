import multer from 'multer';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const allowedTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

export const uploadBookImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.get(extension) !== file.mimetype) {
      return cb(new AppError('Only valid JPEG, PNG, and WebP image files are allowed', 422, 'INVALID_IMAGE_TYPE'));
    }
    cb(null, true);
  },
});

function hasValidImageSignature(file: Express.Multer.File) {
  const header = file.buffer.subarray(0, 12);
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (extension === '.png') {
    return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return (
    extension === '.webp' &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  );
}

export const validateUploadedBookImages: RequestHandler = (req, _res, next) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.some((file) => !hasValidImageSignature(file))) {
    return next(new AppError('Uploaded file contents do not match a supported image format', 422, 'INVALID_IMAGE_CONTENT'));
  }
  return next();
};
