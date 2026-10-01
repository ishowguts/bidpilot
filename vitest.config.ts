import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/api/src/**/*.test.ts', 'packages/core/src/**/*.test.ts'],
    globals: true,
  },
});
