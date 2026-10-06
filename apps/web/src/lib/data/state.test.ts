import type { SyncResponse, Vehicle } from '@qr/api-client';
import { describe, expect, it } from 'vitest';
import { applyAll, applyMutation, emptyState, mergeSync, type LocalState, type OutboxMutation } from './state.ts';

const NOW = Date.parse('2026-10-06T15:00:00Z');
const DAY = 864e5;

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  type: 'car',
  brand: 'Chevrolet',
  model: 'Onix',
  year: 2019,
  plate: null,
  km: 48000,
  kmAt: new Date(NOW - 61 * DAY).toISOString(),
  kmPerMonth: 1100,
  fipeBrandCode: null,
  fipeModelCode: null,
  fipeYearCode: null,
  fipeCode: null,
  status: 'active',
  position: 0,
  archivedAt: null,
  createdAt: new Date(NOW - 100 * DAY).toISOString(),
  updatedAt: new Date(NOW - 61 * DAY).toISOString(),
  ...over,
});

const base = (): LocalState => ({ ...emptyState(1), cursor: 'c1', vehicles: [vehicle()] });
const mut = <T extends OutboxMutation['type']>(type: T, payload: OutboxMutation<T>['payload']): OutboxMutation =>
  ({ id: `m-${Math.random()}`, type, payload, clientTime: new Date(NOW).toISOString() }) as OutboxMutation;

describe('applyMutation (optimistic reducer)', () => {
  it('creates a vehicle with the initial monthly km by type and archives the replaced one', () => {
    const s = applyMutation(
      base(),
      mut('vehicle.upsert', {
        id: 'v2',
        type: 'moto',
        brand: 'Honda',
        model: 'CG 160',
        year: 2021,
        km: 23100,
        replacesVehicleId: 'v1',
      }),
      NOW,
    );
    expect(s.vehicles.find(v => v.id === 'v2')).toMatchObject({ kmPerMonth: 900, status: 'active', position: 1 });
    expect(s.vehicles.find(v => v.id === 'v1')).toMatchObject({ status: 'archived' });
  });

  it('records above the estimated km move the vehicle km forward', () => {
    const s = applyMutation(
      base(),
      mut('record.upsert', { id: 'r1', vehicleId: 'v1', itemId: 'm1', km: 60000, where: 'home' }),
      NOW,
    );
    expect(s.records).toHaveLength(1);
    expect(s.vehicles[0]).toMatchObject({ km: 60000, kmAt: new Date(NOW).toISOString() });
  });

  it('km update recalculates kmPerMonth; "Está certo" keeps it', () => {
    const updated = applyMutation(base(), mut('vehicle.km', { id: 'v1', km: 50600 }), NOW);
    expect(updated.vehicles[0]!.kmPerMonth).not.toBe(1100);
    const confirmed = applyMutation(base(), mut('vehicle.km', { id: 'v1', confirmEstimate: true }), NOW);
    expect(confirmed.vehicles[0]).toMatchObject({ kmPerMonth: 1100 });
    expect(confirmed.vehicles[0]!.km).toBeGreaterThan(48000);
  });

  it('deleting a vehicle removes its records', () => {
    let s = applyMutation(
      base(),
      mut('record.upsert', { id: 'r1', vehicleId: 'v1', itemId: 'm1', km: 40000, where: 'shop' }),
      NOW,
    );
    s = applyMutation(s, mut('vehicle.delete', { id: 'v1' }), NOW);
    expect(s.vehicles).toHaveLength(0);
    expect(s.records).toHaveLength(0);
  });

  it('archive and restore', () => {
    const archived = applyMutation(base(), mut('vehicle.archive', { id: 'v1' }), NOW);
    expect(archived.vehicles[0]!.status).toBe('archived');
    const restored = applyMutation(archived, mut('vehicle.restore', { id: 'v1' }), NOW);
    expect(restored.vehicles[0]).toMatchObject({ status: 'active', archivedAt: null });
  });
});

describe('mergeSync', () => {
  const me = {
    id: 'u1',
    isAnonymous: true,
    name: null,
    email: null,
    plan: 'free' as const,
    premiumUntil: null,
    credits: 0,
    flags: { appleLogin: false, partsMarketplace: false, ads: true, vehicleLookups: true, fipeCard: true },
  };
  const res = (over: Partial<SyncResponse>): SyncResponse => ({
    cursor: 'c2',
    full: false,
    catalogVersion: 1,
    me,
    vehicles: [],
    records: [],
    lookups: [],
    deleted: { vehicles: [], records: [] },
    ...over,
  });

  it('upserts deltas and removes deleted ids', () => {
    const prev = applyMutation(
      base(),
      mut('record.upsert', { id: 'r1', vehicleId: 'v1', itemId: 'm1', km: 40000, where: 'home' }),
      NOW,
    );
    const merged = mergeSync(
      prev,
      res({ vehicles: [vehicle({ km: 49000 })], deleted: { vehicles: [], records: ['r1'] } }),
    );
    expect(merged.cursor).toBe('c2');
    expect(merged.vehicles[0]!.km).toBe(49000);
    expect(merged.records).toHaveLength(0);
  });

  it('replaces everything on a full response', () => {
    const merged = mergeSync(base(), res({ full: true, vehicles: [] }));
    expect(merged.vehicles).toHaveLength(0);
  });

  it('pending mutations are re-applied on top of a pull (rebase)', () => {
    const pending = [mut('record.upsert', { id: 'r9', vehicleId: 'v1', itemId: 'm2', km: 41000, where: 'home' })];
    const merged = applyAll(mergeSync(base(), res({ vehicles: [vehicle()] })), pending, NOW);
    expect(merged.records.map(r => r.id)).toEqual(['r9']);
  });
});
