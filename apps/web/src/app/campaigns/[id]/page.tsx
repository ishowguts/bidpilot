'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cpaSeries, cumulativeApplies, publisherKeys, shareSeries, spendSeries } from '@/lib/charts';
import { inr, int, pct, signedPct } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import { Card, Empty, ErrorBox, Loading } from '@/components/ui';
import { CpaChart, CumulativeChart, ShareChart, SpendChart } from '@/components/charts';

/** The advance endpoint takes at most 30 days per call (§8). */
const MAX_ADVANCE = 30;

async function loadDashboard(id: string) {
  const campaign = await api.getCampaign(id);
  const [summary, daily, baselineDaily] = await Promise.all([
    api.summary(id),
    api.dailyStats(id),
    campaign.baselineId ? api.dailyStats(campaign.baselineId) : Promise.resolve(null),
  ]);
  return { campaign, summary, daily, baselineDaily };
}

export default function DashboardPage({ params }: { params: { id: string } }) {
  const { data, error, loading, reload } = useApi(() => loadDashboard(params.id), params.id);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<Error>();

  async function advance(days: number) {
    setAdvancing(true);
    setAdvanceError(undefined);
    try {
      for (let left = days; left > 0; left -= MAX_ADVANCE)
        await api.advance(params.id, Math.min(left, MAX_ADVANCE));
    } catch (e) {
      setAdvanceError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setAdvancing(false);
      reload();
    }
  }

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { campaign, summary, daily, baselineDaily } = data;
  const remaining = campaign.days - campaign.currentDay;
  const keys = publisherKeys(daily);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:underline">
            ← Campaigns
          </Link>
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <p className="text-sm text-slate-500">
            {campaign.policy} · {campaign.scenario} · seed {campaign.seed} · {inr(campaign.dailyBudget)}/day ·
            day {campaign.currentDay} of {campaign.days}
            {campaign.baselineOf && (
              <>
                {' '}
                · equal-split baseline of{' '}
                <Link href={`/campaigns/${campaign.baselineOf}`} className="underline">
                  its campaign
                </Link>
              </>
            )}
          </p>
        </div>
        {campaign.baselineOf === null && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={advancing || remaining === 0}
              onClick={() => advance(1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Advance 1 day
            </button>
            <button
              type="button"
              disabled={advancing || remaining === 0}
              onClick={() => advance(remaining)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {advancing ? 'Advancing…' : 'Advance to end'}
            </button>
          </div>
        )}
      </div>
      {advanceError && <ErrorBox error={advanceError} />}
      {loading && <Loading label="Refreshing…" />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Total applies" value={int(summary.applies)} />
        <Tile label="CPA" value={inr(summary.cpa)} />
        <Tile
          label="CPA vs equal split"
          value={summary.baseline ? signedPct(summary.deltaCpaPct) : 'no baseline'}
          tone={summary.deltaCpaPct == null ? undefined : summary.deltaCpaPct < 0 ? 'good' : 'bad'}
        />
        <Tile label="Pacing ratio" value={pct(summary.pacingRatio)} />
        <Tile
          label="Overdelivery"
          value={inr(summary.overdelivery)}
          tone={summary.overdelivery > 0 ? 'bad' : 'good'}
        />
      </div>

      {daily.length === 0 ? (
        <Empty>No traffic yet. Advance the campaign to simulate its first day.</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Spend vs budget per day">
            <SpendChart data={spendSeries(daily, campaign.dailyBudget)} dailyBudget={campaign.dailyBudget} />
          </Card>
          <Card title="Cost per apply by publisher (7-day rolling)">
            <CpaChart data={cpaSeries(daily)} keys={keys} />
          </Card>
          <Card title="Budget share by publisher per day">
            <ShareChart data={shareSeries(daily)} keys={keys} />
          </Card>
          <Card title={baselineDaily ? 'Cumulative applies, BidPilot vs equal split' : 'Cumulative applies'}>
            <CumulativeChart
              data={cumulativeApplies(daily, baselineDaily)}
              hasBaseline={baselineDaily !== null}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-700' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
