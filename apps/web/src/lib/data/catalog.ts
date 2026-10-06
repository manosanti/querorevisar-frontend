// Catalog + manufacturer plans come from the static /catalog.v{N}.json (cached forever, SWR in the SW).
import { catalogForVehicle, type Catalog, type CatalogItem, type ManufacturerPlan, type VehicleType } from '@qr/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { env } from '../../env.ts';
import { qk } from './query.ts';

export interface CatalogFile {
  version: number;
  catalog: Catalog;
  plans: ManufacturerPlan[];
}

async function fetchCatalog(version: number): Promise<CatalogFile> {
  const res = await fetch(`/catalog.v${version}.json`);
  if (!res.ok) throw new Error(`catalog ${version}: ${res.status}`);
  return (await res.json()) as CatalogFile;
}

export function useCatalog(version: number = env.catalogVersion) {
  return useQuery({
    queryKey: qk.catalog(version),
    queryFn: () => fetchCatalog(version),
    staleTime: Infinity,
    networkMode: 'offlineFirst',
  });
}

/** Catalog items for one vehicle, merged with its manufacturer plan. */
export function useVehicleItems(
  vehicle: { type: VehicleType; brand: string; model: string } | null | undefined,
): CatalogItem[] {
  const { data } = useCatalog();
  const type = vehicle?.type;
  const brand = vehicle?.brand;
  const model = vehicle?.model;
  return useMemo(
    () => (data && type && brand && model ? catalogForVehicle(data.catalog, data.plans, { type, brand, model }) : []),
    [data, type, brand, model],
  );
}

export function itemsForVehicle(
  file: CatalogFile | undefined,
  vehicle: { type: VehicleType; brand: string; model: string },
): CatalogItem[] {
  return file ? catalogForVehicle(file.catalog, file.plans, vehicle) : [];
}
