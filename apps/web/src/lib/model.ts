// Derived view model shared by the screens: active vehicle, estimated km and the status of every item.
import {
  barPercent,
  compareAttention,
  credTxt,
  estimateKm,
  itemStatus,
  KEY_ITEMS,
  KEY_ITEMS_LIMIT,
  kmLabel,
  statusBadge,
  statusLine,
  type CatalogItem,
  type DueStatus,
} from '@qr/core';
import type { LookupSummary, MaintenanceRecord, Me, Vehicle } from '@qr/api-client';
import { useEffect, useMemo, useState } from 'react';
import { useVehicleItems } from './data/catalog.ts';
import { useSyncState } from './data/sync.ts';
import { useUi } from './ui-store.ts';

export interface ItemRow {
  item: CatalogItem;
  status: DueStatus;
  line: string;
  badge: string;
  barPct: number;
}

/** Re-renders every `ms` so estimated km and "faltam" texts stay current. */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function sortVehicles(list: readonly Vehicle[]): Vehicle[] {
  return [...list].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export function buildRows(
  items: readonly CatalogItem[],
  records: readonly MaintenanceRecord[],
  vehicle: Vehicle,
  now: number,
): ItemRow[] {
  const est = estimateKm(vehicle, now);
  const recs = records.filter(r => r.vehicleId === vehicle.id);
  return items.map(item => {
    const status = itemStatus(item, recs, est, now);
    return {
      item,
      status,
      line: statusLine(item, status, vehicle.kmPerMonth),
      badge: statusBadge(status),
      barPct: barPercent(status),
    };
  });
}

export interface AppModel {
  me: Me | null;
  plan: 'free' | 'premium';
  credits: number;
  creditsLabel: string;
  vehicles: Vehicle[];
  archived: Vehicle[];
  vehicle: Vehicle | null;
  records: MaintenanceRecord[];
  lookups: LookupSummary[];
  vehicleRecords: MaintenanceRecord[];
  items: CatalogItem[];
  rows: ItemRow[];
  estKm: number;
  kmLabel: string;
  counts: { over: number; warn: number; ok: number };
  attention: ItemRow[];
  unregisteredKey: ItemRow[];
  isAnonymous: boolean;
  loaded: boolean;
}

export function useAppModel(): AppModel {
  const { data: state } = useSyncState();
  const activeId = useUi(s => s.activeVehicleId);
  const now = useNow();

  const vehicles = useMemo(
    () => sortVehicles((state?.vehicles ?? []).filter(v => v.status === 'active')),
    [state?.vehicles],
  );
  const archived = useMemo(
    () =>
      (state?.vehicles ?? [])
        .filter(v => v.status === 'archived')
        .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [state?.vehicles],
  );
  const vehicle = vehicles.find(v => v.id === activeId) ?? vehicles[0] ?? null;
  const items = useVehicleItems(vehicle);
  const records = useMemo(() => state?.records ?? [], [state?.records]);
  const vehicleRecords = useMemo(
    () => (vehicle ? records.filter(r => r.vehicleId === vehicle.id) : []),
    [records, vehicle],
  );

  const rows = useMemo(() => (vehicle ? buildRows(items, records, vehicle, now) : []), [items, records, vehicle, now]);
  const derived = useMemo(() => {
    const counts = { over: 0, warn: 0, ok: 0 };
    for (const r of rows) if (r.status.key !== 'none') counts[r.status.key] += 1;
    const attention = rows
      .filter(r => r.status.key === 'over' || r.status.key === 'warn')
      .sort((a, b) => compareAttention(a.status, b.status));
    const keySet = new Set<string>(KEY_ITEMS);
    const unregisteredKey = rows
      .filter(r => r.status.key === 'none' && keySet.has(r.item.name))
      .slice(0, KEY_ITEMS_LIMIT);
    return { counts, attention, unregisteredKey };
  }, [rows]);

  const me = state?.me ?? null;
  const credits = me?.credits ?? 0;
  return {
    me,
    plan: me?.plan ?? 'free',
    credits,
    creditsLabel: credTxt(credits),
    vehicles,
    archived,
    vehicle,
    records,
    lookups: state?.lookups ?? [],
    vehicleRecords,
    items,
    rows,
    estKm: vehicle ? estimateKm(vehicle, now) : 0,
    kmLabel: vehicle ? kmLabel(vehicle, now) : 'Km atual',
    ...derived,
    isAnonymous: me?.isAnonymous ?? true,
    loaded: !!state,
  };
}

export const vehicleName = (v: Pick<Vehicle, 'brand' | 'model'>) => `${v.brand} ${v.model}`;
