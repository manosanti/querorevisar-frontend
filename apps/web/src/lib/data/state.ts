// Local mirror of GET /v1/sync plus the pure reducer used for optimistic updates.
// The API applies the same mutations (POST /v1/sync); both converge on the next sync.
import { applyKmUpdate, confirmEstimate, INITIAL_KM_PER_MONTH, kmAfterRecord } from '@qr/core';
import type {
  LookupSummary,
  MaintenanceRecord,
  Me,
  RecordCreate,
  SyncMutationType,
  SyncResponse,
  Vehicle,
  VehicleCreate,
} from '@qr/api-client';

export interface LocalState {
  cursor: string | null;
  catalogVersion: number;
  me: Me | null;
  vehicles: Vehicle[];
  records: MaintenanceRecord[];
  lookups: LookupSummary[];
}

export type MutationPayloads = {
  'vehicle.upsert': VehicleCreate;
  'vehicle.archive': { id: string };
  'vehicle.restore': { id: string };
  'vehicle.delete': { id: string };
  'vehicle.km': { id: string; km?: number | null; confirmEstimate?: boolean | null };
  'record.upsert': RecordCreate;
  'record.delete': { id: string };
};

export interface OutboxMutation<T extends SyncMutationType = SyncMutationType> {
  id: string;
  type: T;
  payload: MutationPayloads[T];
  clientTime: string;
}

export const emptyState = (catalogVersion: number): LocalState => ({
  cursor: null,
  catalogVersion,
  me: null,
  vehicles: [],
  records: [],
  lookups: [],
});

function upsertById<T extends { id: string }>(list: readonly T[], items: readonly T[]): T[] {
  if (!items.length) return list as T[];
  const byId = new Map(list.map(x => [x.id, x] as const));
  for (const it of items) byId.set(it.id, it);
  return [...byId.values()];
}

/** Merges a sync response into the local state (full replace when the server says so). */
export function mergeSync(prev: LocalState | undefined, res: SyncResponse): LocalState {
  if (!prev || res.full) {
    return {
      cursor: res.cursor,
      catalogVersion: res.catalogVersion,
      me: res.me,
      vehicles: res.vehicles,
      records: res.records,
      lookups: res.lookups,
    };
  }
  const goneVehicles = new Set(res.deleted.vehicles);
  const goneRecords = new Set(res.deleted.records);
  return {
    cursor: res.cursor,
    catalogVersion: res.catalogVersion,
    me: res.me,
    vehicles: upsertById(prev.vehicles, res.vehicles).filter(v => !goneVehicles.has(v.id)),
    records: upsertById(prev.records, res.records).filter(
      r => !goneRecords.has(r.id) && !goneVehicles.has(r.vehicleId),
    ),
    lookups: upsertById(prev.lookups, res.lookups).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

function patchVehicle(state: LocalState, id: string, patch: (v: Vehicle) => Vehicle): LocalState {
  return { ...state, vehicles: state.vehicles.map(v => (v.id === id ? patch(v) : v)) };
}

/** Applies one mutation locally. Validation happens before enqueueing (see actions.ts). */
export function applyMutation(state: LocalState, m: OutboxMutation, now: number = Date.now()): LocalState {
  const at = iso(now);
  switch (m.type) {
    case 'vehicle.upsert': {
      const p = m.payload as VehicleCreate;
      const existing = state.vehicles.find(v => v.id === p.id);
      const position = existing?.position ?? state.vehicles.reduce((max, v) => Math.max(max, v.position + 1), 0);
      const vehicle: Vehicle = {
        id: p.id,
        type: p.type,
        brand: p.brand,
        model: p.model,
        year: p.year,
        plate: p.plate ?? null,
        km: p.km,
        kmAt: existing && existing.km === p.km ? existing.kmAt : at,
        kmPerMonth: existing?.kmPerMonth ?? INITIAL_KM_PER_MONTH[p.type],
        fipeBrandCode: p.fipeBrandCode ?? null,
        fipeModelCode: p.fipeModelCode ?? null,
        fipeYearCode: p.fipeYearCode ?? null,
        fipeCode: existing?.fipeCode ?? null,
        status: existing?.status ?? 'active',
        position,
        archivedAt: existing?.archivedAt ?? null,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      let next: LocalState = { ...state, vehicles: upsertById(state.vehicles, [vehicle]) };
      if (p.replacesVehicleId) {
        next = patchVehicle(next, p.replacesVehicleId, v => ({
          ...v,
          status: 'archived',
          archivedAt: at,
          updatedAt: at,
        }));
      }
      return next;
    }
    case 'vehicle.archive': {
      const { id } = m.payload as { id: string };
      return patchVehicle(state, id, v => ({ ...v, status: 'archived', archivedAt: at, updatedAt: at }));
    }
    case 'vehicle.restore': {
      const { id } = m.payload as { id: string };
      return patchVehicle(state, id, v => ({ ...v, status: 'active', archivedAt: null, updatedAt: at }));
    }
    case 'vehicle.delete': {
      const { id } = m.payload as { id: string };
      return {
        ...state,
        vehicles: state.vehicles.filter(v => v.id !== id),
        records: state.records.filter(r => r.vehicleId !== id),
      };
    }
    case 'vehicle.km': {
      const p = m.payload as MutationPayloads['vehicle.km'];
      return patchVehicle(state, p.id, v => {
        if (p.confirmEstimate) {
          const c = confirmEstimate(v, now);
          return { ...v, km: c.km, kmAt: iso(c.kmAt), updatedAt: at };
        }
        const maxRecord = state.records.filter(r => r.vehicleId === v.id).reduce((a, r) => Math.max(a, r.km), 0);
        const out = applyKmUpdate(v, p.km ?? v.km, maxRecord, now);
        if (!out.ok) return v;
        return { ...v, km: out.km, kmAt: iso(out.kmAt), kmPerMonth: out.kmPerMonth, updatedAt: at };
      });
    }
    case 'record.upsert': {
      const p = m.payload as RecordCreate;
      const existing = state.records.find(r => r.id === p.id);
      const record: MaintenanceRecord = {
        id: p.id,
        vehicleId: p.vehicleId,
        itemId: p.itemId,
        km: p.km,
        date: p.date ?? null,
        costCents: p.costCents ?? null,
        brand: p.brand ?? null,
        where: p.where,
        createdAt: existing?.createdAt ?? at,
        updatedAt: at,
      };
      const next = { ...state, records: upsertById(state.records, [record]) };
      return patchVehicle(next, p.vehicleId, v => {
        const moved = kmAfterRecord(v, p.km, now);
        return moved ? { ...v, km: moved.km, kmAt: iso(moved.kmAt), updatedAt: at } : v;
      });
    }
    case 'record.delete': {
      const { id } = m.payload as { id: string };
      return { ...state, records: state.records.filter(r => r.id !== id) };
    }
    default:
      return state;
  }
}

export function applyAll(state: LocalState, pending: readonly OutboxMutation[], now: number = Date.now()): LocalState {
  return pending.reduce((s, m) => applyMutation(s, m, now), state);
}
