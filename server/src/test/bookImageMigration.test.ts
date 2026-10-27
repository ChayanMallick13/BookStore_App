import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Book } from '../models/Book.js';
import { Author } from '../models/Author.js';
import { Category } from '../models/Category.js';
import { setupTestDb, teardownTestDb } from './helpers.js';
import { migrateBookImages } from '../services/bookImageMigration.js';

describe('legacy book image migration', () => {
  let uploadsDirectory: string;
  let categoryId: string;
  let authorId: string;

  beforeAll(async () => {
    await setupTestDb();
    uploadsDirectory = await mkdtemp(path.join(os.tmpdir(), 'books-bin-images-'));
    const category = await Category.create({ name: 'Migration', slug: 'migration' });
    const author = await Author.create({ name: 'Migration Author', slug: 'migration-author' });
    categoryId = String(category._id);
    authorId = String(author._id);
    await writeFile(
      path.join(uploadsDirectory, 'legacy-cover.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]),
    );
  });

  afterAll(async () => {
    if (uploadsDirectory) {
      await rm(uploadsDirectory, { recursive: true, force: true });
    }
    await teardownTestDb();
  });

  it('supports dry-run and an idempotent subsequent migration', async () => {
    const book = await Book.create({
      title: 'Legacy Image',
      slug: 'legacy-image',
      isbn: '9781234567890',
      description: 'A book with a local legacy image.',
      category: categoryId,
      author: authorId,
      price: 100,
      stock: 1,
      coverImages: ['/uploads/books/legacy-cover.png'],
    });
    const upload = vi.fn().mockResolvedValue({
      publicId: `books-bin/books/book-${book.id}-fingerprint`,
      secureUrl: 'https://res.cloudinary.com/test/image/upload/legacy-cover.png',
      resourceType: 'image',
      format: 'png',
      width: 10,
      height: 10,
    });

    const dryRun = await migrateBookImages([book], { dryRun: true, uploadsDirectory, upload });
    expect(dryRun).toMatchObject({ assetsPlanned: 1, assetsMigrated: 0, failures: 0 });
    expect(upload).not.toHaveBeenCalled();
    expect(book.coverImages[0]).toBe('/uploads/books/legacy-cover.png');

    const migrated = await migrateBookImages([book], { dryRun: false, uploadsDirectory, upload });
    expect(migrated).toMatchObject({ assetsMigrated: 1, failures: 0 });
    expect(book.coverImages[0]).toBe('https://res.cloudinary.com/test/image/upload/legacy-cover.png');
    expect(book.coverAssets[0].publicId).toContain('books-bin/books/');

    const rerun = await migrateBookImages([book], { dryRun: false, uploadsDirectory, upload });
    expect(rerun).toMatchObject({ assetsMigrated: 0, assetsSkipped: 1, failures: 0 });
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
