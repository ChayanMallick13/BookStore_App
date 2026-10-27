import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDb, teardownTestDb, getTestApp } from './helpers.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Author } from '../models/Author.js';
import { Book } from '../models/Book.js';
import * as cloudinaryService from '../services/cloudinaryService.js';

describe('Books CRUD', () => {
  const app = getTestApp();
  let adminCookie: string[];
  let categoryId: string;
  let authorId: string;

  beforeAll(async () => {
    await setupTestDb();
    await User.create({
      email: 'admin@test.com',
      name: 'Admin',
      passwordHash: await bcrypt.hash('adminpass123', 12),
      role: 'admin',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'adminpass123',
    });
    adminCookie = login.headers['set-cookie'];
    const cat = await Category.create({ name: 'Fiction', slug: 'fiction' });
    const author = await Author.create({ name: 'Jane Doe', slug: 'jane-doe' });
    categoryId = String(cat._id);
    authorId = String(author._id);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  afterEach(() => vi.restoreAllMocks());

  it('creates, lists, updates and archives a book', async () => {
    const create = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'Test Book')
      .field('isbn', '9781111111111')
      .field('description', 'A wonderful test book for Books Bin catalog.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '299')
      .field('stock', '10')
      .field('featured', 'true');
    expect(create.status).toBe(201);
    const bookId = create.body.data.id;

    const catalog = await request(app).get('/api/v1/books?q=Test');
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.some((b: { id: string }) => b.id === bookId)).toBe(true);

    const update = await request(app)
      .patch(`/api/v1/admin/books/${bookId}`)
      .set('Cookie', adminCookie)
      .send({ price: 349, stock: 5 });
    expect(update.status).toBe(200);
    expect(update.body.data.price).toBe(349);

    const del = await request(app).delete(`/api/v1/admin/books/${bookId}`).set('Cookie', adminCookie);
    expect(del.status).toBe(200);
    const still = await Book.findById(bookId);
    expect(still).toBeNull();
  });

  it('rejects duplicate ISBN', async () => {
    await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'ISBN Holder')
      .field('isbn', '9781111111111')
      .field('description', 'First book holding the isbn for duplicate test case.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '199')
      .field('stock', '2');

    const res = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'Duplicate ISBN Book')
      .field('isbn', '9781111111111')
      .field('description', 'Another book with duplicate isbn should fail validation.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '199')
      .field('stock', '2');
    expect(res.status).toBe(409);
  });

  it('parses multipart false values and does not expose inactive books via public admin filters', async () => {
    const create = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'Inactive Test Book')
      .field('isbn', '9782222222222')
      .field('description', 'An inactive test book that should remain visible only to administrators.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '199')
      .field('stock', '4')
      .field('featured', 'false')
      .field('isActive', 'false');

    expect(create.status).toBe(201);
    expect(create.body.data.isActive).toBe(false);
    expect(create.body.data.featured).toBe(false);

    const publicList = await request(app).get('/api/v1/books?admin=true&q=Inactive');
    expect(publicList.status).toBe(200);
    expect(publicList.body.data).toHaveLength(0);

    const adminList = await request(app)
      .get('/api/v1/admin/books?q=Inactive')
      .set('Cookie', adminCookie);
    expect(adminList.status).toBe(200);
    expect(adminList.body.data).toHaveLength(1);
    expect(adminList.body.data[0].isActive).toBe(false);
  });

  it('rejects uploaded files whose bytes do not match an allowed image format', async () => {
    const response = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'Spoofed Image Book')
      .field('isbn', '9784444444444')
      .field('description', 'The uploaded cover has an image extension but invalid bytes.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '199')
      .field('stock', '1')
      .attach('covers', Buffer.from('not a real image'), {
        filename: 'spoofed.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_IMAGE_CONTENT');
  });

  it('uploads new covers to Cloudinary, replaces old assets, and cleans up on book deletion', async () => {
    const firstAsset = {
      publicId: 'books-bin/books/first-cover',
      secureUrl: 'https://res.cloudinary.com/test/image/upload/first-cover.webp',
      resourceType: 'image' as const,
      format: 'webp',
      width: 800,
      height: 1200,
    };
    const replacementAsset = {
      ...firstAsset,
      publicId: 'books-bin/books/replacement-cover',
      secureUrl: 'https://res.cloudinary.com/test/image/upload/replacement-cover.webp',
    };
    const imageHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    const upload = vi.spyOn(cloudinaryService, 'uploadBookImage')
      .mockResolvedValueOnce(firstAsset)
      .mockResolvedValueOnce(replacementAsset);
    const deleteAsset = vi.spyOn(cloudinaryService, 'deleteCloudinaryAsset').mockResolvedValue();

    const create = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'Cloudinary Cover Book')
      .field('isbn', '9785555555555')
      .field('description', 'A book whose covers live in Cloudinary.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '299')
      .field('stock', '2')
      .attach('covers', imageHeader, { filename: 'cover.png', contentType: 'image/png' });

    expect(create.status).toBe(201);
    const bookId = create.body.data.id as string;
    const savedBook = await Book.findById(bookId);
    expect(upload).toHaveBeenCalledWith(imageHeader);
    expect(savedBook?.coverImages).toEqual([firstAsset.secureUrl]);
    expect(savedBook?.coverAssets[0].toObject()).toMatchObject(firstAsset);

    const update = await request(app)
      .patch(`/api/v1/admin/books/${bookId}`)
      .set('Cookie', adminCookie)
      .attach('covers', imageHeader, { filename: 'replacement.png', contentType: 'image/png' });
    expect(update.status).toBe(200);
    expect(update.body.data.coverImages).toEqual([replacementAsset.secureUrl]);
    expect(deleteAsset).toHaveBeenCalledWith({
      publicId: firstAsset.publicId,
      resourceType: firstAsset.resourceType,
    });

    const deleted = await request(app)
      .delete(`/api/v1/admin/books/${bookId}`)
      .set('Cookie', adminCookie);
    expect(deleted.status).toBe(200);
    expect(deleteAsset).toHaveBeenCalledWith({
      publicId: replacementAsset.publicId,
      resourceType: replacementAsset.resourceType,
    });
  });

  it('cleans up an uploaded Cloudinary image if book persistence fails', async () => {
    const asset = {
      publicId: 'books-bin/books/orphan-cover',
      secureUrl: 'https://res.cloudinary.com/test/image/upload/orphan-cover.webp',
      resourceType: 'image' as const,
    };
    vi.spyOn(cloudinaryService, 'uploadBookImage').mockResolvedValue(asset);
    const deleteAsset = vi.spyOn(cloudinaryService, 'deleteCloudinaryAsset').mockResolvedValue();
    vi.spyOn(Book, 'create').mockRejectedValueOnce(new Error('database write failed'));
    const imageHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

    const response = await request(app)
      .post('/api/v1/admin/books')
      .set('Cookie', adminCookie)
      .field('title', 'Persistence Failure Book')
      .field('isbn', '9786666666666')
      .field('description', 'The database write will fail after image upload.')
      .field('category', categoryId)
      .field('author', authorId)
      .field('price', '199')
      .field('stock', '1')
      .attach('covers', imageHeader, { filename: 'orphan.png', contentType: 'image/png' });

    expect(response.status).toBe(500);
    expect(deleteAsset).toHaveBeenCalledWith({ publicId: asset.publicId, resourceType: 'image' });
  });

  it('lets administrators rename and hide catalog collections and authors', async () => {
    const renamedCategory = await request(app)
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Modern Fiction', isActive: false });
    expect(renamedCategory.status).toBe(200);
    expect(renamedCategory.body.data.slug).toBe('modern-fiction');
    expect(renamedCategory.body.data.isActive).toBe(false);

    const renamedAuthor = await request(app)
      .patch(`/api/v1/admin/authors/${authorId}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Jane Example', bio: 'A test author.' });
    expect(renamedAuthor.status).toBe(200);
    expect(renamedAuthor.body.data.slug).toBe('jane-example');
  });
});
