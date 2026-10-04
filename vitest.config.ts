import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: 'pure',
          include: ['packages/core/src/**/*.test.ts', 'experiments/src/**/*.test.ts'],
        },
      },
      {
        // API tests share one Postgres test database, so their files run one at a time.
        test: {
          name: 'api',
          include: ['apps/api/src/**/*.test.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
