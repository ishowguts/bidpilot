// Seeds the demo campaign shown on the deployed dashboard (ARCHITECTURE §13): a Thompson campaign with its paired
// equal-split baseline, advanced to its last day. Idempotent: re-running finds the campaign by name and only
// advances whatever days are left, so it is safe on every deploy.
import { and, eq, isNull } from 'drizzle-orm';
import { campaigns, createClient, type Database } from '@bidpilot/db';
import { parseEnv } from './env.js';
import { advanceCampaign, createCampaign } from './services/campaigns.js';

export const DEMO = {
  name: 'Demo: emerging publisher',
  dailyBudget: 20_000,
  days: 30,
  policy: 'thompson',
  scenario: 'emergence',
  seed: 1,
  startDate: '2026-10-01',
  compareBaseline: true,
} as const;

export async function seedDemo(db: Database): Promise<{ id: string; advanced: number }> {
  const [existing] = await db
    .select({ id: campaigns.id, currentDay: campaigns.currentDay })
    .from(campaigns)
    .where(and(eq(campaigns.name, DEMO.name), isNull(campaigns.baselineOf)));
  const id = existing?.id ?? (await createCampaign(db, DEMO)).id;
  const left = DEMO.days - (existing?.currentDay ?? 0);
  if (left > 0) await advanceCampaign(db, id, left);
  return { id, advanced: left };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createClient(parseEnv().DATABASE_URL);
  const { id, advanced } = await seedDemo(db);
  console.log(`seed-demo: campaign ${id}, advanced ${advanced} day(s)`);
  process.exit(0);
}
