/**
 * Checks a Postgres connection string before any driver sees it, and fails without ever including the value in the
 * message: drivers echo an invalid URL verbatim, which puts a password into deploy logs.
 */
export function databaseUrl(value: string | undefined, name = 'DATABASE_URL'): string {
  const fail = (why: string): never => {
    throw new Error(`${name} ${why} (the value is not printed).`);
  };
  if (!value) return fail('is not set');
  if (/\s/.test(value)) {
    return fail(
      'contains spaces or a line break: set it to the connection string itself, not a command or a quote',
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail('is not a valid URL: expected postgres://user:password@host:port/database');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return fail(`must start with postgres:// or postgresql://, not ${url.protocol}//`);
  }
  if (!url.hostname) return fail('has no host');
  return value;
}
