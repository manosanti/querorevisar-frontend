// User actions: validate with the domain rules (exact prototype messages), then write through the outbox.
import { applyKmUpdate, fmtInt } from '@qr/core';
import type { RecordCreate, Vehicle, VehicleCreate } from '@qr/api-client';
import { toast } from '@qr/ui';
import { track } from './analytics.ts';
import { enqueue } from './data/sync.ts';
import { newId } from './ids.ts';
import type { OutboxMutation, MutationPayloads } from './data/state.ts';
import type { SyncMutationType } from '@qr/api-client';

function mutation<T extends SyncMutationType>(type: T, payload: MutationPayloads[T]): OutboxMutation<T> {
  return { id: newId(), type, payload, clientTime: new Date().toISOString() };
}

export async function createVehicle(input: Omit<VehicleCreate, 'id'>): Promise<string> {
  const id = newId();
  await enqueue(mutation('vehicle.upsert', { ...input, id }));
  track('vehicle_created', { type: input.type });
  return id;
}

export async function archiveVehicle(id: string): Promise<void> {
  await enqueue(mutation('vehicle.archive', { id }));
}

export async function restoreVehicle(id: string): Promise<void> {
  await enqueue(mutation('vehicle.restore', { id }));
}

export async function deleteVehicle(id: string): Promise<void> {
  await enqueue(mutation('vehicle.delete', { id }));
}

/** "Salvar" in "Rodou quanto?": returns false (and shows the error) when the km is invalid. */
export async function updateKm(vehicle: Vehicle, km: number | null, maxRecordKm: number): Promise<boolean> {
  if (km === null) {
    toast('Digite o km do painel ou toque em "Está certo"', 'err');
    return false;
  }
  const check = applyKmUpdate(vehicle, km, maxRecordKm);
  if (!check.ok) {
    toast(check.error, 'err');
    return false;
  }
  await enqueue(mutation('vehicle.km', { id: vehicle.id, km }));
  track('km_updated', { mode: 'manual' });
  toast('Km atualizada');
  return true;
}

export async function confirmKm(vehicle: Vehicle): Promise<void> {
  await enqueue(mutation('vehicle.km', { id: vehicle.id, confirmEstimate: true }));
  track('km_updated', { mode: 'confirm' });
  toast('Km confirmada');
}

export interface RecordDraft {
  itemId: string | null;
  km: number | null;
  date: string;
  costCents: number | null;
  brand: string;
  where: 'home' | 'shop';
}

/** "Salvar" in "Registrar troca". Validations and messages from docs/domain.md#registro. */
export async function saveRecord(vehicleId: string, draft: RecordDraft): Promise<boolean> {
  if (!draft.itemId) {
    toast('Escolha o item que você trocou', 'err');
    return false;
  }
  if (draft.km === null || draft.km <= 0) {
    toast('Informe o km de quando trocou', 'err');
    return false;
  }
  if (draft.date && new Date(`${draft.date}T12:00`).getTime() > Date.now()) {
    toast('A data não pode ser no futuro', 'err');
    return false;
  }
  const payload: RecordCreate = {
    id: newId(),
    vehicleId,
    itemId: draft.itemId,
    km: Math.round(draft.km),
    date: draft.date || null,
    costCents: draft.costCents,
    brand: draft.brand.trim() || null,
    where: draft.where,
  };
  await enqueue(mutation('record.upsert', payload));
  track('record_created', { where: draft.where, hasCost: draft.costCents !== null, hasDate: !!draft.date });
  toast('Troca registrada');
  return true;
}

export const kmHint = (km: number | null, estKm: number): string =>
  km !== null && km > estKm
    ? `Maior que a km estimada. Vamos atualizar a km atual para ${fmtInt(km)}.`
    : 'O km do painel no dia da troca, não o de hoje.';
