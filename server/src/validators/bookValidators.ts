import { z } from 'zod';

const formBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const bookCreateSchema = z.object({
  title: z.string().min(1).max(300),
  isbn: z.string().min(10).max(20),
  description: z.string().min(10),
  category: z.string().regex(/^[a-f\d]{24}$/i),
  author: z.string().regex(/^[a-f\d]{24}$/i),
  publisher: z.string().max(200).optional(),
  publishedAt: z.coerce.date().optional(),
  price: z.coerce.number().min(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  stock: z.coerce.number().int().min(0),
  featured: formBoolean.optional().default(false),
  isActive: formBoolean.optional().default(true),
});

export const bookUpdateSchema = bookCreateSchema.partial();

export const bookQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sort: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().optional(),
  category: z.string().optional(),
  author: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  inStock: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  featured: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  admin: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});
