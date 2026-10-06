// Credit packs and pricing (docs/domain.md#créditos). ✏️ Prices are owner decisions (PENDENCIAS.md).
import { CREDIT_UNIT_PRICE_CENTS } from './constants.ts';

export interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
  tag?: string;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'pack-1', credits: 1, priceCents: 490 },
  { id: 'pack-5', credits: 5, priceCents: 2190 },
  { id: 'pack-12', credits: 12, priceCents: 4790, tag: 'Mais escolhido' },
  { id: 'pack-30', credits: 30, priceCents: 10490 },
];

/** Index of the highlighted pack ("Mais escolhido"), pre-selected when nothing is missing. */
export const DEFAULT_PACK_INDEX = 2;

export function unitPriceCents(pack: Pick<CreditPack, 'credits' | 'priceCents'>): number {
  return Math.round(pack.priceCents / pack.credits);
}

/** "Economia de N%": N = round((1 − price / (n × unit)) × 100). */
export function discountPct(
  pack: Pick<CreditPack, 'credits' | 'priceCents'>,
  unit: number = CREDIT_UNIT_PRICE_CENTS,
): number {
  return Math.round((1 - pack.priceCents / (pack.credits * unit)) * 100);
}

/** Smallest pack that covers `missing` credits; the highlighted pack when nothing is missing. */
export function packIndexFor(missing: number, packs: readonly CreditPack[] = CREDIT_PACKS): number {
  if (!missing) return DEFAULT_PACK_INDEX;
  const i = packs.findIndex(p => p.credits >= missing);
  return i < 0 ? packs.length - 1 : i;
}
