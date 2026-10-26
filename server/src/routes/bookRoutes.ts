import { Router } from 'express';
import * as bookController from '../controllers/bookController.js';
import { validateQuery, validateBody } from '../middleware/validate.js';
import { bookQuerySchema, bookCreateSchema, bookUpdateSchema } from '../validators/bookValidators.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadBookImages, validateUploadedBookImages } from '../middleware/upload.js';

const router = Router();

router.get('/', validateQuery(bookQuerySchema), bookController.listBooks);
router.get('/slug/:slug', bookController.getBook);
router.get('/:id', bookController.getBook);

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  uploadBookImages.array('covers', 5),
  validateUploadedBookImages,
  validateBody(bookCreateSchema),
  bookController.createBook,
);

router.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  uploadBookImages.array('covers', 5),
  validateUploadedBookImages,
  validateBody(bookUpdateSchema),
  bookController.updateBook,
);

router.delete('/:id', authenticate, requireRole('admin'), bookController.deleteBook);

export default router;
