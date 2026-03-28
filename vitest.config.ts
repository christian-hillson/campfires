import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
    env: {
      JWT_SECRET: 'test-secret-do-not-use-in-production',
    },
  },
});
