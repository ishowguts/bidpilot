'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { POLICY_VALUES, SCENARIO_VALUES, createCampaignSchema, type Campaign } from '@bidpilot/shared';
import { api } from '@/lib/api';
import { inr, pct } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import { Card, Empty, ErrorBox, Loading } from '@/components/ui';

export default function CampaignsPage() {
  const campaigns = useApi(() => api.listCampaigns(), 'campaigns');
  // Baselines are reached from their campaign's dashboard.
  const visible = campaigns.data?.filter((c) => c.baselineOf === null);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="pb-3 xl:col-span-2">
        <p className="section-label">Budget allocation / Campaigns</p>
        <h1 className="workspace-heading">Make every application count.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Compare spending strategies across six simulated publishers. No real ads or payments are involved.
        </p>
      </section>
      <Card title="Your campaigns">
        {campaigns.error ? (
          <ErrorBox error={campaigns.error} onRetry={campaigns.reload} />
        ) : !visible ? (
          <Loading />
        ) : visible.length === 0 ? (
          <Empty>No campaigns yet. Create one to start simulating traffic.</Empty>
        ) : (
          <CampaignTable campaigns={visible} />
        )}
      </Card>
      <Card title="Set up a simulation">
        <CreateForm />
      </Card>
    </div>
  );
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="campaign-table">
        <caption className="sr-only">Campaign strategies, daily budgets, and simulated days</caption>
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Policy</th>
            <th className="py-2 pr-3">Scenario</th>
            <th className="py-2 pr-3 text-right">Daily budget</th>
            <th className="py-2 text-right">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td className="py-2 pr-3">
                <Link href={`/campaigns/${c.id}`} className="font-medium text-teal-800 hover:underline">
                  {c.name}
                </Link>
              </td>
              <td className="py-2 pr-3">{c.policy}</td>
              <td className="py-2 pr-3">{c.scenario}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{inr(c.dailyBudget)}</td>
              <td className="py-2 text-right tabular-nums">
                day {c.currentDay}/{c.days} ({pct(c.progress, 0)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const field = 'campaign-field';

function CreateForm() {
  const router = useRouter();
  const [error, setError] = useState<Error>();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const seed = String(form.get('seed') ?? '').trim();
    const parsed = createCampaignSchema.safeParse({
      name: form.get('name'),
      dailyBudget: Number(form.get('dailyBudget')),
      days: Number(form.get('days')),
      policy: form.get('policy'),
      scenario: form.get('scenario'),
      ...(seed ? { seed: Number(seed) } : {}),
      compareBaseline: form.get('compareBaseline') === 'on',
    });
    if (!parsed.success) {
      setError(new Error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const created = await api.createCampaign(parsed.data);
      router.push(`/campaigns/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 text-sm">
      <label className="block">
        Name
        <input name="name" required maxLength={120} placeholder="e.g. Engineering hiring" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          Daily budget (₹)
          <input
            name="dailyBudget"
            type="number"
            min={1000}
            max={1000000}
            step={100}
            defaultValue={20000}
            className={field}
          />
        </label>
        <label className="block">
          Days
          <input name="days" type="number" min={1} max={90} defaultValue={30} className={field} />
        </label>
        <label className="block">
          Policy
          <select name="policy" defaultValue="thompson" className={field}>
            {POLICY_VALUES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Scenario
          <select name="scenario" defaultValue="stationary" className={field}>
            {SCENARIO_VALUES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        Seed (optional)
        <input name="seed" type="number" min={0} step={1} placeholder="random" className={field} />
      </label>
      <p className="text-xs leading-relaxed text-slate-500">
        Reuse a seed to compare strategies against the same simulated traffic. Leave it blank for a new run.
      </p>
      <label className="flex items-center gap-2">
        <input name="compareBaseline" type="checkbox" defaultChecked />
        Compare with an equal budget split
      </label>
      {error && <ErrorBox error={error} />}
      <button type="submit" disabled={submitting} className="workspace-button w-full">
        {submitting ? 'Creating…' : 'Create campaign'}
      </button>
    </form>
  );
}
