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
  console.error("Failed to start server:", err);
  console.error("Error message:", err?.message);
  console.error("Error stack:", err?.stack);
  process.exit(1);
});

