// FIPE card texts (docs/domain.md#fipe-no-card-do-veículo).
import { DAY_MS } from './constants.ts';

export type FipeTrend = 'up' | 'down' | 'flat';

export function fipeTrend(deltaPct: number | null | undefined): FipeTrend {
  if (!deltaPct) return 'flat';
  return deltaPct > 0 ? 'up' : 'down';
}

/** "▲ 1,2% em 30 dias", "▼ 0,8% em 30 dias" or "Estável em 30 dias". deltaPct is a percentage (1.2 = 1,2%). */
export function fipeDeltaText(deltaPct: number | null | undefined): string {
  const rounded = Math.round((deltaPct ?? 0) * 10) / 10;
  if (!rounded) return 'Estável em 30 dias';
  const abs = Math.abs(rounded).toFixed(1).replace('.', ',');
  return `${rounded > 0 ? '▲' : '▼'} ${abs}% em 30 dias`;
}

/** "atualizada há N dias" (singular for one day, "hoje" on the same day). */
export function fipeUpdatedText(updatedAt: string | number, now: number = Date.now()): string {
  const t = typeof updatedAt === 'number' ? updatedAt : Date.parse(updatedAt);
  const days = Math.max(0, Math.floor((now - t) / DAY_MS));
  if (days === 0) return 'atualizada hoje';
  return days === 1 ? 'atualizada há 1 dia' : `atualizada há ${days} dias`;
}
