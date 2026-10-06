// TanStack Query client persisted in IndexedDB (idb-keyval). staleTime 5 min for user data,
// Infinity for the catalog, no refetch on window focus (docs/PLAN.json F06.3).
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { env } from '../../env.ts';

export const qk = {
  sync: (userId: string) => ['sync', userId] as const,
  catalog: (version: number) => ['catalog', version] as const,
  fipe: (vehicleId: string) => ['fipe', vehicleId] as const,
  fipeBrands: (type: string) => ['fipe-brands', type] as const,
  fipeModels: (type: string, brand: string) => ['fipe-models', type, brand] as const,
  fipeYears: (type: string, brand: string, model: string) => ['fipe-years', type, brand, model] as const,
  lookup: (id: string) => ['lookup', id] as const,
  lookupProducts: () => ['lookup-products'] as const,
  creditPacks: () => ['credit-packs'] as const,
  purchase: (id: string) => ['purchase', id] as const,
  premium: () => ['premium'] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => failureCount < 2 && !(error instanceof Error && error.name === 'ApiError'),
    },
  },
});

const PERSISTED = new Set(['sync', 'catalog', 'fipe', 'fipe-brands', 'fipe-models', 'fipe-years', 'lookup']);

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({
    storage: { getItem: key => get(key), setItem: (key, value) => set(key, value), removeItem: key => del(key) },
    key: 'qr-query-cache',
    throttleTime: 800,
  }),
  maxAge: 30 * 24 * 60 * 60 * 1000,
  buster: `${env.release}:${env.catalogVersion}`,
  dehydrateOptions: {
    shouldDehydrateQuery: q => q.state.status === 'success' && PERSISTED.has(String(q.queryKey[0])),
  },
};

/** Logout: wipe every cached query and the persisted copy. */
export async function clearQueryCache(): Promise<void> {
  queryClient.clear();
  await del('qr-query-cache');
}
