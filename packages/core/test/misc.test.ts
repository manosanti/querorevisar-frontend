import { describe, expect, it } from 'vitest';
import {
  CREDIT_PACKS,
  discountPct,
  fipeDeltaText,
  fipeUpdatedText,
  fmtInt,
  isValidPlate,
  lookupSummary,
  maskPlate,
  money,
  moneyShort,
  normalizePlate,
  packIndexFor,
  parseMoneyToCents,
  parseNumber,
  unitPriceCents,
  type LookupSection,
} from '../src/index.ts';
import { readJson } from './fixtures.ts';

const plainSpaces = (s: string) => s.replace(/\u00a0/g, ' ');

describe('format', () => {
  it('formats integers and money in pt-BR', () => {
    expect(fmtInt(48000)).toBe('48.000');
    expect(fmtInt(-0)).toBe('0');
    expect(plainSpaces(money(1490))).toBe('R$ 14,90');
    expect(plainSpaces(moneyShort(6240000))).toBe('R$ 62.400');
  });

  it('parses user input', () => {
    expect(parseNumber('48.000')).toBe(48000);
    expect(parseNumber('')).toBeNull();
    expect(parseMoneyToCents('189,90')).toBe(18990);
  });
});

describe('plate', () => {
  it('normalizes and validates', () => {
    expect(normalizePlate('abc-1d23x')).toBe('ABC1D23');
    expect(isValidPlate('ABC1D23')).toBe(true);
    expect(isValidPlate('ABC1234')).toBe(true);
    expect(isValidPlate('AB1D234')).toBe(false);
    expect(maskPlate('ABC1D23')).toBe('ABC1***');
  });
});

describe('credits', () => {
  it('computes unit price and savings like the prototype', () => {
    const out = CREDIT_PACKS.map(p => [p.credits, unitPriceCents(p), discountPct(p)]);
    expect(out).toEqual([
      [1, 490, 0],
      [5, 438, 11],
      [12, 399, 19],
      [30, 350, 29],
    ]);
  });

  it('picks the smallest pack that covers the missing credits', () => {
    expect(packIndexFor(0)).toBe(2);
    expect(packIndexFor(1)).toBe(0);
    expect(packIndexFor(4)).toBe(1);
    expect(packIndexFor(6)).toBe(2);
    expect(packIndexFor(99)).toBe(3);
  });
});

interface LookupFixture {
  cases: Array<{ expected: { sections: LookupSection[]; summary: { flags: number; text: string; tone: string } } }>;
}

describe('lookups (fixtures/lookup-mock.json)', () => {
  const fx = readJson<LookupFixture>('fixtures/lookup-mock.json');
  it.each(fx.cases.map((c, i) => [i, c] as const))('summary #%s', (_i, c) => {
    expect(lookupSummary(c.expected.sections)).toEqual(c.expected.summary);
  });
});

describe('fipe', () => {
  it('describes the 30-day variation', () => {
    expect(fipeDeltaText(1.2)).toBe('▲ 1,2% em 30 dias');
    expect(fipeDeltaText(-0.8)).toBe('▼ 0,8% em 30 dias');
    expect(fipeDeltaText(0)).toBe('Estável em 30 dias');
    expect(fipeDeltaText(0.04)).toBe('Estável em 30 dias');
  });

  it('describes the cache age', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(fipeUpdatedText(now - 3 * 864e5, now)).toBe('atualizada há 3 dias');
    expect(fipeUpdatedText(now - 864e5, now)).toBe('atualizada há 1 dia');
    expect(fipeUpdatedText(now, now)).toBe('atualizada hoje');
  });
});
