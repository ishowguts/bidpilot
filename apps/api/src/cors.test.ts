import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { normalizeOrigin, parseEnv } from './env.js';
import { testDb, testEnv } from './test/setup.js';

const ORIGIN = 'https://bidpilot.vercel.app';

/** An app whose allowlist comes from `CORS_ORIGINS` exactly as a dashboard would supply it. */
const appWith = (corsOrigins: string) =>
  createApp({
    env: parseEnv({ DATABASE_URL: testEnv.DATABASE_URL, LOG_LEVEL: 'silent', CORS_ORIGINS: corsOrigins }),
    db: testDb,
  });

describe('normalizeOrigin', () => {
  it('strips a trailing slash, a path, surrounding quotes and case', () => {
    for (const v of [
      `${ORIGIN}/`,
      `${ORIGIN}/campaigns/x`,
      ' HTTPS://BidPilot.Vercel.App ',
      `"${ORIGIN}"`,
      `'${ORIGIN}/',`,
    ])
      expect(normalizeOrigin(v)).toBe(ORIGIN);
  });

  it('adds https to a bare host and http to a loopback host', () => {
    expect(normalizeOrigin('bidpilot.vercel.app/')).toBe(ORIGIN);
    expect(normalizeOrigin('localhost:3100')).toBe('http://localhost:3100');
    expect(normalizeOrigin('127.0.0.1:3100')).toBe('http://127.0.0.1:3100');
  });

  it('returns an empty string for something that is not an origin', () => {
    expect(normalizeOrigin('  ,')).toBe('');
    expect(normalizeOrigin('https://')).toBe('');
  });
});

describe('CORS allowlist', () => {
  it('allows the exact Vercel origin even when the configured value has a trailing slash', async () => {
    for (const configured of [ORIGIN, `${ORIGIN}/`, ` ${ORIGIN.toUpperCase()}/ , http://localhost:3100`]) {
      const res = await request(appWith(configured)).get('/api/health').set('origin', ORIGIN);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    }
  });

  it('answers the preflight for a JSON POST', async () => {
    const res = await request(appWith(`${ORIGIN}/`))
      .options('/api/campaigns')
      .set('origin', ORIGIN)
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('gives no CORS headers to another origin', async () => {
    const res = await request(appWith(ORIGIN)).get('/api/health').set('origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
