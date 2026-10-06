// Km update rules from docs/domain.md#km. Mirrored in Kotlin; both run fixtures/km-update.json.
import { MONTH_MS } from './constants.ts';
import { estimateKm, type KmState } from './due.ts';
import { fmtInt } from './format.ts';

export type KmUpdateResult = { ok: true; km: number; kmAt: number; kmPerMonth: number } | { ok: false; error: string };

/**
 * Saving a new panel km `newKm`:
 * rejects values below the highest record km; recalculates kmPerMonth when more than half a month passed
 * and the km went up; otherwise keeps it.
 */
export function applyKmUpdate(
  v: KmState,
  newKm: number,
  maxRecordKm: number,
  now: number = Date.now(),
): KmUpdateResult {
  if (newKm < maxRecordKm)
    return { ok: false, error: `Km menor que a última troca registrada (${fmtInt(maxRecordKm)} km)` };
  const kmAt = typeof v.kmAt === 'number' ? v.kmAt : Date.parse(v.kmAt);
  const months = (now - kmAt) / MONTH_MS;
  const kmPerMonth = months > 0.5 && newKm > v.km ? Math.max(1, Math.round((newKm - v.km) / months)) : v.kmPerMonth;
  return { ok: true, km: newKm, kmAt: now, kmPerMonth };
}

/** "Está certo": accepts the estimate as the current km without touching kmPerMonth. */
export function confirmEstimate(
  v: KmState,
  now: number = Date.now(),
): { km: number; kmAt: number; kmPerMonth: number } {
  return { km: estimateKm(v, now), kmAt: now, kmPerMonth: v.kmPerMonth };
}

/** A record above the estimated km moves the vehicle km forward (docs/domain.md#registro). */
export function kmAfterRecord(
  v: KmState,
  recordKm: number,
  now: number = Date.now(),
): { km: number; kmAt: number } | null {
  return recordKm > estimateKm(v, now) ? { km: recordKm, kmAt: now } : null;
}
