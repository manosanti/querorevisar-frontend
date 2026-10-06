import { describe, expect, it } from 'vitest';
import {
  barPercent,
  estimateKm,
  intervalText,
  itemStatus,
  statusBadge,
  statusLine,
  type DueStatusKey,
} from '../src/index.ts';
import { readJson } from './fixtures.ts';

interface DueCase {
  name: string;
  vehicle: { type: 'car' | 'moto'; km: number; kmAt: string; kmPerMonth: number };
  item: { id: string; name: string; km: number | null; months: number | null };
  records: Array<{ itemId: string; km: number; date: string | null }>;
  expected: {
    estimatedKm: number;
    status: DueStatusKey;
    recordKm: number | null;
    pct: number | null;
    kmLeft: number | null;
    monthsLeft: number | null;
    byTime: boolean;
    dueKm: number | null;
    line: string;
    badge: string;
    barPct: number;
    intervalText: string;
  };
}

const fx = readJson<{ now: string; cases: DueCase[] }>('fixtures/due-status.json');
const now = Date.parse(fx.now);

describe('due status (fixtures/due-status.json)', () => {
  it('has at least 30 cases', () => {
    expect(fx.cases.length).toBeGreaterThanOrEqual(30);
  });

  it.each(fx.cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const est = estimateKm(c.vehicle, now);
    expect(est).toBe(c.expected.estimatedKm);
    const s = itemStatus(c.item, c.records, est, now);
    expect(s.key).toBe(c.expected.status);
    expect(s.record?.km ?? null).toBe(c.expected.recordKm);
    if (c.expected.pct === null) expect(s.pct).toBe(0);
    else expect(s.pct).toBeCloseTo(c.expected.pct, 5);
    expect(s.kmLeft).toBe(c.expected.kmLeft);
    if (c.expected.monthsLeft === null) expect(s.monthsLeft).toBeNull();
    else expect(s.monthsLeft).toBeCloseTo(c.expected.monthsLeft, 5);
    expect(s.byTime).toBe(c.expected.byTime);
    expect(s.dueKm).toBe(c.expected.dueKm);
    expect(statusLine(c.item, s, c.vehicle.kmPerMonth)).toBe(c.expected.line);
    expect(statusBadge(s)).toBe(c.expected.badge);
    expect(barPercent(s)).toBe(c.expected.barPct);
    expect(intervalText(c.item)).toBe(c.expected.intervalText);
  });
});
