import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`BookHaven API listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
