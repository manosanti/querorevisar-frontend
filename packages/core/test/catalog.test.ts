import { describe, expect, it } from 'vitest';
import { catalogForVehicle, findPlan, type Catalog, type ManufacturerPlan } from '../src/index.ts';
import { readJson } from './fixtures.ts';

const catalog = readJson<Catalog>('data/catalog.json');
const plans = readJson<{ plans: ManufacturerPlan[] }>('data/planos.json').plans;

type Picked = { id: string; km: number | null; months: number | null; source: string };
interface MergeCase {
  vehicle: { type: 'car' | 'moto'; brand: string; model: string };
  count: number;
  overridden: Picked[];
  sample: Picked[];
}
const merge = readJson<{ cases: MergeCase[] }>('fixtures/catalog-merge.json');
const pick = (i: Picked): Picked => ({ id: i.id, km: i.km, months: i.months, source: i.source });

describe('seed data (F01.3)', () => {
  it('catalog.json keeps every prototype item', () => {
    // reference/catalog.js declares 33 categories and 196 items (window.QR_CATALOG.total).
    expect(catalog.categories).toHaveLength(33);
    expect(catalog.categories.reduce((n, c) => n + c.items.length, 0)).toBe(catalog.total);
    expect(catalog.total).toBe(196);
  });

  it('planos.json keeps the Pulsar N150 plan', () => {
    expect(plans).toHaveLength(1);
    expect(findPlan(plans, 'Bajaj', 'Pulsar N150')?.id).toBe('bajaj-pulsar-n150');
    expect(findPlan(plans, 'Honda', 'CG 160')).toBeNull();
  });
});

describe('catalogForVehicle (fixtures/catalog-merge.json)', () => {
  it.each(merge.cases.map(c => [`${c.vehicle.brand} ${c.vehicle.model}`, c] as const))('%s', (_n, c) => {
    const items = catalogForVehicle(catalog, plans, c.vehicle);
    expect(items).toHaveLength(c.count);
    expect(items.filter(i => i.source !== 'Média QueroRevisar').map(pick)).toEqual(c.overridden);
    expect(items.slice(0, 5).map(pick)).toEqual(c.sample);
  });
});
