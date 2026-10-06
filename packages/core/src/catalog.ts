// Catalog (data/catalog.json) merged with the manufacturer plan (data/planos.json) for one vehicle.
import { normalizeText } from './format.ts';
import type { VehicleType } from './due.ts';

export interface CatalogItemRaw {
  id: string;
  name: string;
  km: number | null;
  months: number | null;
  desc: string;
  insp: boolean;
  types: VehicleType[];
}

export interface CatalogCategoryRaw {
  id: string;
  group: string;
  name: string;
  icon: string[];
  types: VehicleType[];
  items: CatalogItemRaw[];
}

export interface Catalog {
  version: number;
  total: number;
  categories: CatalogCategoryRaw[];
  icons: Record<string, string[]>;
}

export interface PlanRule {
  acoes: string[];
  intervaloKm: number;
  intervaloMeses: number;
}

export interface ManufacturerPlan {
  id: string;
  brand: string;
  model: string;
  type: VehicleType;
  categories: Array<{ items: Array<{ name?: string; nome?: string; rules?: PlanRule[] }> }>;
}

export interface CatalogItem extends CatalogItemRaw {
  categoryId: string;
  categoryName: string;
  icon: string[];
  /** "Plano {marca}" when the manufacturer plan sets the interval, otherwise "Média QueroRevisar". */
  source: string;
}

export const DEFAULT_SOURCE = 'Média QueroRevisar';

export function findPlan(plans: readonly ManufacturerPlan[], brand: string, model: string): ManufacturerPlan | null {
  return plans.find(p => p.brand === brand && p.model === model) ?? null;
}

export function catalogForVehicle(
  catalog: Catalog,
  plans: readonly ManufacturerPlan[],
  vehicle: { type: VehicleType; brand: string; model: string },
): CatalogItem[] {
  const plan = findPlan(plans, vehicle.brand, vehicle.model);
  const fromPlan = new Map<string, { km: number; months: number }>();
  if (plan) {
    for (const c of plan.categories) {
      for (const pi of c.items) {
        const rule = (pi.rules ?? []).find(r => (r.acoes ?? []).includes('trocar'));
        if (rule)
          fromPlan.set(normalizeText(pi.name ?? pi.nome), { km: rule.intervaloKm, months: rule.intervaloMeses });
      }
    }
  }
  const out: CatalogItem[] = [];
  for (const c of catalog.categories) {
    for (const it of c.items) {
      if (!it.types.includes(vehicle.type)) continue;
      const f = fromPlan.get(normalizeText(it.name));
      out.push({
        ...it,
        categoryId: c.id,
        categoryName: c.name,
        icon: c.icon,
        km: f ? f.km : it.km,
        months: f ? f.months : it.months,
        source: f && plan ? `Plano ${plan.brand}` : DEFAULT_SOURCE,
      });
    }
  }
  return out;
}
