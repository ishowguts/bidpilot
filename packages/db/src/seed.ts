import postgres from 'postgres';
import { databaseUrl } from './url.js';

// Ids are fixed: the core simulator identifies publishers as 1..6 (pub-a .. pub-f).
const PUBLISHERS = [
  { id: 1, slug: 'pub-a', name: 'Publisher A' },
  { id: 2, slug: 'pub-b', name: 'Publisher B' },
  { id: 3, slug: 'pub-c', name: 'Publisher C' },
  { id: 4, slug: 'pub-d', name: 'Publisher D' },
  { id: 5, slug: 'pub-e', name: 'Publisher E' },
  { id: 6, slug: 'pub-f', name: 'Publisher F' },
];

async function seed() {
  const url = databaseUrl(process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/bidpilot');
  const sql = postgres(url, { prepare: false });

  // Upsert publishers so running seed twice is safe and a wrong name or id is corrected.
  for (const pub of PUBLISHERS) {
    await sql`
      INSERT INTO publishers (id, slug, name)
      VALUES (${pub.id}, ${pub.slug}, ${pub.name})
      ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name
    `;
  }
  await sql`SELECT setval(pg_get_serial_sequence('publishers', 'id'), (SELECT max(id) FROM publishers))`;
  const unexpected = await sql`SELECT slug FROM publishers WHERE id > ${PUBLISHERS.length}`;
  if (unexpected.length > 0)
    throw new Error(`unexpected publishers in database: ${unexpected.map((r) => r.slug).join(', ')}`);

  const count = await sql`SELECT count(*)::int AS n FROM publishers`;
  console.log(`seed: ${count[0].n} publishers in database`);
  await sql.end();
}

seed().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
