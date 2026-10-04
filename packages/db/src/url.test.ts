import { describe, it, expect } from 'vitest';
import { databaseUrl } from './url.js';

const SECRET = 's3cret-Pa55';

describe('databaseUrl', () => {
  it('accepts postgres URLs, including pooler URLs with query parameters', () => {
    for (const url of [
      'postgres://postgres:postgres@localhost:5433/bidpilot',
      `postgresql://postgres.abcd:${SECRET}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
    ])
      expect(databaseUrl(url)).toBe(url);
  });

  it('rejects a pasted shell command, a quoted value, a wrong scheme and an empty value without echoing them', () => {
    const bad = [
      `grep '^DATABASE_URL_PROD=' ~/bidpilot/.env | cut -d= -f2- | tr -d '\\n' | pbcopy`,
      `"postgres://u:${SECRET}@host:5432/db"`,
      `https://u:${SECRET}@host/db`,
      `postgres://u:${SECRET}@host:5432/db\n`,
      `not a url ${SECRET}`,
      '',
      undefined,
    ];
    for (const value of bad) {
      let message = '';
      try {
        databaseUrl(value);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/^DATABASE_URL /);
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain('grep');
    }
  });
});
