import { describe, expect, it } from 'vitest';
import { applyKmUpdate, confirmEstimate, estimateKm, kmAfterRecord, kmLabel } from '../src/index.ts';
import { readJson } from './fixtures.ts';

interface KmCase {
  name: string;
  vehicle: { km: number; kmAt: string; kmPerMonth: number };
  maxRecordKm: number;
  newKm: number;
  expected: { error: string } | { km: number; kmAt: string; kmPerMonth: number };
}

const fx = readJson<{ now: string; cases: KmCase[] }>('fixtures/km-update.json');
const now = Date.parse(fx.now);
const DAY = 864e5;

describe('km update (fixtures/km-update.json)', () => {
  it.each(fx.cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const out = applyKmUpdate(c.vehicle, c.newKm, c.maxRecordKm, now);
    if ('error' in c.expected) {
      expect(out).toEqual({ ok: false, error: c.expected.error });
    } else {
      expect(out).toEqual({
        ok: true,
        km: c.expected.km,
        kmAt: Date.parse(c.expected.kmAt),
        kmPerMonth: c.expected.kmPerMonth,
      });
    }
  });

  it('"Está certo" keeps kmPerMonth and stores the estimate', () => {
    const v = { km: 48000, kmAt: now - 61 * DAY, kmPerMonth: 1100 };
    expect(confirmEstimate(v, now)).toEqual({ km: estimateKm(v, now), kmAt: now, kmPerMonth: 1100 });
  });

  it('a record above the estimate moves the vehicle km forward', () => {
    const v = { km: 48000, kmAt: now, kmPerMonth: 1100 };
    expect(kmAfterRecord(v, 49000, now)).toEqual({ km: 49000, kmAt: now });
    expect(kmAfterRecord(v, 47000, now)).toBeNull();
  });

  it('labels the km as estimated after 3 days', () => {
    expect(kmLabel({ km: 1, kmAt: now - 2 * DAY, kmPerMonth: 1 }, now)).toBe('Km atual');
    expect(kmLabel({ km: 1, kmAt: now - 4 * DAY, kmPerMonth: 1 }, now)).toBe('Km estimada');
  });
});
