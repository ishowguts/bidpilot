'use client';
import type { ReactElement } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Point } from '@/lib/charts';
import { inr, int, pct } from '@/lib/format';

const COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#9333ea'];

function Frame({ children }: { children: ReactElement }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const dayAxis = <XAxis dataKey="day" tickLine={false} fontSize={12} />;
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />;

export function SpendChart({ data, dailyBudget }: { data: Point[]; dailyBudget: number }) {
  return (
    <Frame>
      <LineChart data={data}>
        {grid}
        {dayAxis}
        <YAxis fontSize={12} tickFormatter={(v: number) => inr(v)} width={80} />
        <Tooltip formatter={(v: number) => inr(v)} labelFormatter={(d) => `Day ${d}`} />
        <ReferenceLine
          y={dailyBudget}
          stroke="#64748b"
          strokeDasharray="6 4"
          label={{ value: 'budget', fontSize: 11 }}
        />
        <Line type="monotone" dataKey="spend" stroke={COLORS[0]} dot={false} isAnimationActive={false} />
      </LineChart>
    </Frame>
  );
}

export function CpaChart({ data, keys }: { data: Point[]; keys: string[] }) {
  return (
    <Frame>
      <LineChart data={data}>
        {grid}
        {dayAxis}
        <YAxis fontSize={12} tickFormatter={(v: number) => inr(v)} width={80} />
        <Tooltip formatter={(v: number) => inr(v)} labelFormatter={(d) => `Day ${d}`} />
        <Legend />
        {keys.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={COLORS[i % COLORS.length]}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Frame>
  );
}

export function ShareChart({ data, keys }: { data: Point[]; keys: string[] }) {
  return (
    <Frame>
      <AreaChart data={data} stackOffset="expand">
        {grid}
        {dayAxis}
        <YAxis fontSize={12} tickFormatter={(v: number) => pct(v, 0)} width={48} />
        <Tooltip formatter={(v: number) => pct(v)} labelFormatter={(d) => `Day ${d}`} />
        <Legend />
        {keys.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            stackId="share"
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </Frame>
  );
}

export function CumulativeChart({ data, hasBaseline }: { data: Point[]; hasBaseline: boolean }) {
  return (
    <Frame>
      <LineChart data={data}>
        {grid}
        {dayAxis}
        <YAxis fontSize={12} tickFormatter={(v: number) => int(v)} width={56} />
        <Tooltip formatter={(v: number) => int(v)} labelFormatter={(d) => `Day ${d}`} />
        <Legend />
        <Line
          type="monotone"
          dataKey="campaign"
          name="BidPilot"
          stroke={COLORS[0]}
          dot={false}
          isAnimationActive={false}
        />
        {hasBaseline && (
          <Line
            type="monotone"
            dataKey="baseline"
            name="Equal split"
            stroke="#64748b"
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </Frame>
  );
}
