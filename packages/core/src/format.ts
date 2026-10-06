// pt-BR formatting helpers. Money is always carried in cents and formatted only at the edge.

const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Rounded integer with pt-BR grouping ("48.000"). Never prints "-0". */
export function fmtInt(n: number): string {
  return intFmt.format(Math.round(n) || 0);
}

/** "R$ 14,90" (Intl uses a no-break space after R$). */
export function money(cents: number): string {
  return brl.format(cents / 100);
}

/** FIPE value without cents when they are zero: "R$ 62.400". */
export function moneyShort(cents: number): string {
  return money(cents).replace(/,00$/, '');
}

/** Parses "48.000", "48000" or "1.234,5" into a number; null when empty/invalid. */
export function parseNumber(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(v) ? null : v;
}

/** Parses a money input ("189,90") into cents. */
export function parseMoneyToCents(s: string | null | undefined): number | null {
  const v = parseNumber(s);
  return v === null ? null : Math.round(v * 100);
}

/** Lowercase, accent-free text for search and plan matching. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const credTxt = (n: number): string => (n === 1 ? '1 crédito' : `${n} créditos`);
export const recordsTxt = (n: number): string => (n === 1 ? '1 registro' : `${n} registros`);

/** dd/mm/aaaa for a YYYY-MM-DD date (noon local avoids timezone shifts). */
export function dateBR(date: string): string {
  return new Date(`${date}T12:00`).toLocaleDateString('pt-BR');
}

/** "12 de mar. de 2026" style used in history lines. */
export function dateLongBR(date: string): string {
  return new Date(`${date}T12:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Today as YYYY-MM-DD in local time. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
