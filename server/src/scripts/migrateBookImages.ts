import { Book } from '../models/Book.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { errorDetails } from '../utils/errorDetails.js';
import { loadBooksForImageMigration, migrateBookImages } from '../services/bookImageMigration.js';

async function main() {
  const dryRun = !process.argv.includes('--apply');
  await connectDb();
  const books = await loadBooksForImageMigration(Book);
  logger.info('Starting legacy book image migration', {
    operation: 'cloudinary.migration',
    mode: dryRun ? 'dry-run' : 'apply',
    books: books.length,
  });
  const summary = await migrateBookImages(books, {
    dryRun,
    onProgress: (message) => logger.info(message, { operation: 'cloudinary.migration' }),
  });
  logger.info('Legacy book image migration finished', {
    operation: 'cloudinary.migration',
    ...summary,
  });
  await disconnectDb();
  if (summary.failures > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  logger.error('Legacy book image migration failed', {
    operation: 'cloudinary.migration',
    error: errorDetails(error),
  });
  await disconnectDb().catch(() => undefined);
  process.exitCode = 1;
});
