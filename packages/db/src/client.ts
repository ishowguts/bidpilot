import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { databaseUrl } from './url.js';

export function createClient(connectionString: string) {
  // No prepared statements: the Supabase transaction pooler (PgBouncer) cannot keep them across transactions.
  const sql = postgres(databaseUrl(connectionString), { prepare: false });
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createClient>;

/** A database handle or an open transaction; query helpers accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
