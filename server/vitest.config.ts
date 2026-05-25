import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Run suites sequentially — integration tests share a real DB
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
