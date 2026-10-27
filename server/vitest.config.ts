import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
