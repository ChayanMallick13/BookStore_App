import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorDetails } from './utils/errorDetails.js';

let startupOperation = 'mongodb.connect';

async function main() {
  await connectDb();
  startupOperation = 'http.listen';
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info('Books Bin API listening', { port: env.PORT });
  });
  server.on('error', (error) => {
    logger.error('HTTP server failed', {
      operation: 'http.listen',
      error: errorDetails(error),
    });
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error('Fatal startup failure', {
    operation: startupOperation,
    error: errorDetails(error),
  });
  process.exit(1);
});
