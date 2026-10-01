import postgres from 'postgres';

const PUBLISHERS = [
  { slug: 'pub-a', name: 'Publisher A' },
  { slug: 'pub-b', name: 'Publisher B' },
  { slug: 'pub-c', name: 'Publisher C' },
  { slug: 'pub-d', name: 'Publisher D' },
  { slug: 'pub-e', name: 'Publisher E' },
  { slug: 'pub-f', name: 'Publisher F' },
];

async function seed() {
  const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/bidpilot';
  const sql = postgres(url);

  // Upsert publishers so running seed twice is safe.
  for (const pub of PUBLISHERS) {
    await sql`
      INSERT INTO publishers (slug, name)
      VALUES (${pub.slug}, ${pub.name})
      ON CONFLICT (slug) DO NOTHING
    `;
  }

  const count = await sql`SELECT count(*)::int AS n FROM publishers`;
  console.log(`seed: ${count[0].n} publishers in database`);
  await sql.end();
}

seed().catch((err) => {
  console.error('seed failed:', err);
  process.exit(1);
});
