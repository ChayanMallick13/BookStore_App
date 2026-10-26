import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function paginateOptions(input: PaginationInput) {
  const skip = (input.page - 1) * input.limit;
  return { skip, limit: input.limit, page: input.page };
}

export function paginationMeta(total: number, input: PaginationInput) {
  const totalPages = Math.ceil(total / input.limit) || 1;
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrev: input.page > 1,
  };
}
