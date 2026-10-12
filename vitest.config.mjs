import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run backend tests in Node.js environment
    environment: 'node',
    // Test file patterns — .test.mjs in server/__tests__/, plus frontend
    // data checks (.test.ts) under src/.
    include: ['server/__tests__/**/*.test.mjs', 'src/**/*.test.ts'],
    // Generous timeout for integration tests
    testTimeout: 15_000,
    // No need for globals — explicit imports are cleaner
    globals: false,
    // Isolate test files to prevent state leakage between suites
    fileParallelism: false,
  },
});
