// Due-status rules from docs/domain.md#vencimento. Mirrored in Kotlin (apps/api .../domain/DueCalculator.kt);
// both implementations run fixtures/due-status.json.
import { DAY_MS, MONTH_MS } from './constants.ts';
import { fmtInt } from './format.ts';

export type VehicleType = 'car' | 'moto';
export type DueStatusKey = 'none' | 'ok' | 'warn' | 'over';

export interface KmState {
  km: number;
  /** Instant of the last informed km (ISO string or epoch ms). */
  kmAt: string | number;
  kmPerMonth: number;
}

export interface IntervalItem {
  id: string;
  km: number | null;
  months: number | null;
}

export interface RecordLike {
  itemId: string;
  km: number;
  /** YYYY-MM-DD (interpreted as UTC midnight) or null when the user doesn't remember. */
  date: string | null;
}

export interface DueStatus {
  key: DueStatusKey;
  record: RecordLike | null;
  pct: number;
  kmLeft: number | null;
  monthsLeft: number | null;
  monthsUsed: number | null;
  byTime: boolean;
  dueKm: number | null;
}

const toMs = (t: string | number): number => (typeof t === 'number' ? t : Date.parse(t));

/** Midnight UTC of a YYYY-MM-DD date, like `new Date('YYYY-MM-DD')`. */
export const dateToMs = (date: string): number => Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date);

export function estimateKm(v: KmState, now: number = Date.now()): number {
  return Math.round(v.km + v.kmPerMonth * Math.max(0, (now - toMs(v.kmAt)) / MONTH_MS));
}

/** "Km estimada" when the last informed km is older than 3 days, otherwise "Km atual". */
export function kmLabel(v: KmState, now: number = Date.now()): 'Km estimada' | 'Km atual' {
  return now - toMs(v.kmAt) > 3 * DAY_MS ? 'Km estimada' : 'Km atual';
}

/** The record with the highest km for the item, or null. */
export function lastRecord<R extends RecordLike>(records: readonly R[], itemId: string): R | null {
  let best: R | null = null;
  for (const r of records) if (r.itemId === itemId && (best === null || r.km > best.km)) best = r;
  return best;
}

export function itemStatus(
  item: IntervalItem,
  records: readonly RecordLike[],
  estimatedKm: number,
  now: number = Date.now(),
): DueStatus {
  const r = lastRecord(records, item.id);
  if (!r) {
    return {
      key: 'none',
      record: null,
      pct: 0,
      kmLeft: null,
      monthsLeft: null,
      monthsUsed: null,
      byTime: false,
      dueKm: null,
    };
  }
  const used = estimatedKm - r.km;
  const pKm = item.km ? used / item.km : 0;
  const monthsUsed = r.date ? (now - dateToMs(r.date)) / MONTH_MS : null;
  const pT = monthsUsed !== null && item.months ? monthsUsed / item.months : 0;
  const pct = Math.max(pKm, pT);
  const key: DueStatusKey = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
  return {
    key,
    record: r,
    pct,
    kmLeft: item.km ? item.km - used : null,
    monthsLeft: monthsUsed !== null && item.months ? item.months - monthsUsed : null,
    monthsUsed,
    byTime: pT > pKm,
    dueKm: item.km ? r.km + item.km : null,
  };
}

/** "{km} km ou {meses} meses", omitting what doesn't exist. */
export function intervalText(item: Pick<IntervalItem, 'km' | 'months'>): string {
  const parts: string[] = [];
  if (item.km) parts.push(`${fmtInt(item.km)} km`);
  if (item.months) parts.push(`${item.months} meses`);
  return parts.join(' ou ');
}

export function timeText(kmLeft: number, kmPerMonth: number): string {
  const weeks = kmLeft / (Math.max(1, kmPerMonth) / 4.345);
  if (weeks < 1.5) return 'esta semana';
  if (weeks < 8) return `cerca de ${Math.round(weeks)} semanas`;
  return `cerca de ${Math.round(weeks / 4.345)} meses`;
}

export function statusLine(item: IntervalItem, s: DueStatus, kmPerMonth: number): string {
  if (s.key === 'none') return `A cada ${intervalText(item)}`;
  if (s.key === 'over') {
    if (s.byTime) return `Trocado há ${Math.round(s.monthsUsed ?? 0)} meses · limite ${item.months ?? ''}`;
    return `Passou ${fmtInt(-(s.kmLeft ?? 0))} km do limite`;
  }
  if (s.byTime && s.monthsLeft !== null) return `Vence em ~${Math.max(1, Math.round(s.monthsLeft))} meses pelo tempo`;
  if (s.kmLeft === null) return `A cada ${intervalText(item)}`;
  return `Faltam ~${fmtInt(s.kmLeft)} km · ${timeText(s.kmLeft, kmPerMonth)}`;
}

export const STATUS_LABEL: Record<DueStatusKey, string> = {
  over: 'Vencido',
  warn: 'Atenção',
  ok: 'Em dia',
  none: 'Sem registro',
};

/** Badge text: "{pct}%" for warn, otherwise the status label. */
export function statusBadge(s: Pick<DueStatus, 'key' | 'pct'>): string {
  return s.key === 'warn' ? `${Math.round(s.pct * 100)}%` : STATUS_LABEL[s.key];
}

/** Progress bar width in percent, capped at 100. */
export function barPercent(s: Pick<DueStatus, 'key' | 'pct'>): number {
  return s.key === 'none' ? 0 : Math.min(100, Math.round(s.pct * 100));
}

/** Painel "Precisa de atenção": over first, then warn, each by highest pct. */
export function compareAttention(a: Pick<DueStatus, 'key' | 'pct'>, b: Pick<DueStatus, 'key' | 'pct'>): number {
  if (a.key === b.key) return b.pct - a.pct;
  return a.key === 'over' ? -1 : 1;
}
