import { connectDb, disconnectDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { errorDetails } from '../utils/errorDetails.js';
import { retryCloudinaryCleanup } from '../services/cloudinaryCleanupService.js';

async function main() {
  await connectDb();
  const summary = await retryCloudinaryCleanup();
  logger.info('Cloudinary cleanup retry finished', {
    operation: 'cloudinary.cleanup.retry',
    ...summary,
  });
  await disconnectDb();
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  logger.error('Cloudinary cleanup retry failed', {
    operation: 'cloudinary.cleanup.retry',
    error: errorDetails(error),
  });
  await disconnectDb().catch(() => undefined);
  process.exitCode = 1;
});
