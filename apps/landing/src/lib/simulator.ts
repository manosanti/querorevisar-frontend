// "Aviso antes de vencer" simulator (Alertas section): engine oil, every 10.000 km or 12 months.
// Mirrors the prototype's renderVals(); the real rule lives in @qr/core (due.ts) and docs/domain.md.
import { fmtInt } from '@qr/core';

export const SIM_ITEM_KM = 10_000;
export const SIM_ITEM_MONTHS = 12;
export const SIM_KM_MAX = 12_000;
export const SIM_KM_STEP = 100;
export const SIM_MONTHS_MAX = 15;
export const SIM_DEFAULT = { km: 8600, months: 7 } as const;

export type Tone = 'ok' | 'warn' | 'over';

export interface AlertView {
  tone: Tone;
  badge: string;
  pctLabel: string;
  /** Bar fill, as a CSS percentage of a track that represents 120% of the interval. */
  width: string;
  line: string;
  why: string;
}

const monthsTxt = (n: number): string => (n === 1 ? `${n} mês` : `${n} meses`);

export function monthsLabel(months: number): string {
  return monthsTxt(months);
}

export function kmLabel(km: number): string {
  return `${fmtInt(km)} km`;
}

export function simulateAlert(km: number, months: number): AlertView {
  const kmPct = km / SIM_ITEM_KM;
  const tPct = months / SIM_ITEM_MONTHS;
  const pct = Math.max(kmPct, tPct);
  const byTime = tPct > kmPct;
  const over = pct >= 1;
  const warn = pct >= 0.8;
  const tone: Tone = over ? 'over' : warn ? 'warn' : 'ok';
  const line = byTime
    ? over
      ? `passou ${monthsTxt(months - SIM_ITEM_MONTHS)} do prazo`
      : `faltam ${monthsTxt(SIM_ITEM_MONTHS - months)}`
    : over
      ? `passou ${fmtInt(km - SIM_ITEM_KM)} km`
      : `faltam ${fmtInt(SIM_ITEM_KM - km)} km`;
  return {
    tone,
    badge: over ? 'Vencido' : warn ? 'Atenção' : 'Em dia',
    pctLabel: `${Math.round(pct * 100)}%`,
    width: `${((Math.min(pct, 1.2) / 1.2) * 100).toFixed(2)}%`,
    line,
    why: byTime
      ? 'Neste caso o prazo de 12 meses chegou antes da km.'
      : 'Neste caso a km chegou antes do prazo de 12 meses.',
  };
}
