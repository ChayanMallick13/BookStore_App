import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { readFile, unlink } from 'fs/promises';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const uploadDir = path.resolve('uploads/books');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export const uploadBookImages = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.has(ext) || !file.mimetype.startsWith('image/')) {
      return cb(new AppError('Invalid image file', 422));
    }
    cb(null, true);
  },
});

function hasValidImageSignature(file: Express.Multer.File, header: Buffer) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (ext === '.png') {
    return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return (
    ext === '.webp' &&
    header.toString('ascii', 0, 4) === 'RIFF' &&
    header.toString('ascii', 8, 12) === 'WEBP'
  );
}

export const validateUploadedBookImages: RequestHandler = async (req, _res, next) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    for (const file of files) {
      const contents = await readFile(file.path);
      if (!hasValidImageSignature(file, contents.subarray(0, 12))) {
        await Promise.all(files.map((uploaded) => unlink(uploaded.path)));
        return next(new AppError('Invalid image contents', 422, 'INVALID_IMAGE_CONTENT'));
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

export function publicUploadPath(filename: string) {
  return `/uploads/books/${filename}`;
}
