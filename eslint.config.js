import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/', '**/build/', '**/.next/', '**/node_modules/', '**/coverage/', 'scripts/'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Forbid I/O imports in packages/core
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['pg', 'pg-*', 'drizzle-*', 'fs', 'fs/*', 'node:fs', 'node:fs/*', 'http', 'node:http', 'https', 'node:https', 'net', 'node:net'],
        },
      ],
    },
  },
);
