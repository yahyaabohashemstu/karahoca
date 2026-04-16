import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run backend tests in Node.js environment
    environment: 'node',
    // Test file patterns — pick up .test.mjs in server/__tests__/
    include: ['server/__tests__/**/*.test.mjs'],
    // Generous timeout for integration tests
    testTimeout: 15_000,
    // No need for globals — explicit imports are cleaner
    globals: false,
    // Isolate test files to prevent state leakage between suites
    fileParallelism: false,
  },
});
