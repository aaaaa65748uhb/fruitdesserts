import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: false,
    hookTimeout: 20000,
    testTimeout: 20000,
    pool: 'forks',
  },
});
