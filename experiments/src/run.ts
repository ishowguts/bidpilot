// Experiments CLI (ARCHITECTURE §6.5):
//   pnpm exp --seeds 20 --days 30 --scenario stationary|drift|emergence|all [--ablation] [--budget 20000]
// Writes experiments/results/results.json and results.md. The README copies results.md; no number appears
// anywhere without coming from these files.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { SCENARIOS } from '@bidpilot/core';
import { DEFAULT_DAILY_BUDGET, runExperiment, toMarkdown, type ExperimentOptions } from './experiment.js';

const argsSchema = z.object({
  seeds: z.coerce.number().int().min(2).max(200).default(20),
  days: z.coerce.number().int().min(1).max(90).default(30),
  scenario: z.enum([...SCENARIOS, 'all']).default('all'),
  budget: z.coerce.number().min(1000).max(1_000_000).default(DEFAULT_DAILY_BUDGET),
  ablation: z.boolean().default(false),
});

function gitCommit(): string {
  try {
    const hash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--', '.', '../packages/core'], { encoding: 'utf8' }).trim();
    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return 'unknown';
  }
}

function main(): void {
  const { values } = parseArgs({
    options: {
      seeds: { type: 'string' },
      days: { type: 'string' },
      scenario: { type: 'string' },
      budget: { type: 'string' },
      ablation: { type: 'boolean' },
    },
    strict: true,
  });
  const parsed = argsSchema.safeParse(values);
  if (!parsed.success) {
    console.error('invalid arguments:', parsed.error.issues.map((i) => `--${i.path.join('.')}: ${i.message}`).join('; '));
    process.exit(2);
  }
  const args = parsed.data;
  const options: ExperimentOptions = {
    seeds: args.seeds,
    days: args.days,
    scenarios: args.scenario === 'all' ? SCENARIOS : [args.scenario],
    dailyBudget: args.budget,
    ablation: args.ablation,
  };
  const command =
    `pnpm exp --seeds ${options.seeds} --days ${options.days} --scenario ${args.scenario}` +
    (args.budget !== DEFAULT_DAILY_BUDGET ? ` --budget ${args.budget}` : '') +
    (options.ablation ? ' --ablation' : '');

  const started = performance.now();
  const rows = runExperiment(options);
  const runtimeSeconds = (performance.now() - started) / 1000;
  const meta = { command, commit: gitCommit(), generatedAt: new Date().toISOString(), runtimeSeconds };

  const resultsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'results');
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, 'results.json'), JSON.stringify({ ...meta, options, rows }, null, 2) + '\n');
  const markdown = toMarkdown(options, rows, meta);
  writeFileSync(join(resultsDir, 'results.md'), markdown);
  console.log(markdown);
}

main();
