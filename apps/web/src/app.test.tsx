// Integration: the real router + screens over a seeded /v1/sync (prototype demo data), with fetch stubbed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MaintenanceRecord, SyncResponse } from '@qr/api-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initAuth } from './lib/auth/store.ts';
import { queryClient } from './lib/data/query.ts';
import { routeTree } from './routeTree.gen.ts';

const DAY = 864e5;
const uid = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const V1 = uid(100);
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const date = (daysAgo: number) => iso(now - daysAgo * DAY).slice(0, 10);
const root = join(import.meta.dirname, '..', '..', '..');
const catalogFile = JSON.stringify({
  version: 1,
  catalog: JSON.parse(readFileSync(join(root, 'data', 'catalog.json'), 'utf8')),
  plans: JSON.parse(readFileSync(join(root, 'data', 'planos.json'), 'utf8')).plans,
});

const rec = (
  id: string,
  itemId: string,
  km: number,
  daysAgo: number | null,
  costCents: number | null,
  brand: string | null,
  where: 'home' | 'shop',
): MaintenanceRecord => ({
  id,
  vehicleId: V1,
  itemId,
  km,
  date: daysAgo === null ? null : date(daysAgo),
  costCents,
  brand,
  where,
  createdAt: iso(now - DAY),
  updatedAt: iso(now - DAY),
});

// prototype demoState(): Chevrolet Onix 2019, 48.000 km informed 61 days ago, 1.100 km/month
const sync: SyncResponse = {
  cursor: 'c1',
  full: true,
  catalogVersion: 1,
  me: {
    id: '00000000-0000-7000-8000-000000000001',
    isAnonymous: false,
    name: 'Rafael',
    email: 'rafael@email.com',
    plan: 'free',
    premiumUntil: null,
    credits: 0,
    flags: { appleLogin: false, partsMarketplace: false, ads: true, vehicleLookups: true, fipeCard: true },
  },
  vehicles: [
    {
      id: V1,
      type: 'car',
      brand: 'Chevrolet',
      model: 'Onix',
      year: 2019,
      plate: null,
      km: 48000,
      kmAt: iso(now - 61 * DAY),
      kmPerMonth: 1100,
      fipeBrandCode: null,
      fipeModelCode: null,
      fipeYearCode: null,
      fipeCode: null,
      status: 'active',
      position: 0,
      archivedAt: null,
      createdAt: iso(now - 100 * DAY),
      updatedAt: iso(now - 61 * DAY),
    },
  ],
  records: [
    rec(uid(1), 'm1', 41500, 172, 18900, 'Lubrax', 'home'),
    rec(uid(2), 'm2', 41500, 172, 3200, null, 'home'),
    rec(uid(3), 'm45', 39700, 260, 12900, 'Cobreq', 'home'),
    rec(uid(4), 'm52', 31000, 790, 6000, null, 'shop'),
    rec(uid(5), 'm27', 46000, 90, 4500, 'Tecfil', 'home'),
    rec(uid(6), 'm32', 38000, null, null, 'NGK', 'home'),
    rec(uid(7), 'm21', 10000, 1300, 48000, null, 'shop'),
  ],
  lookups: [],
  deleted: { vehicles: [], records: [] },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeAll(async () => {
  localStorage.setItem(
    'qr-dev-session',
    JSON.stringify({
      accessToken: 'test-token',
      user: { id: sync.me.id, isAnonymous: false, email: 'rafael@email.com', name: 'Rafael' },
      expiresAt: iso(now + DAY),
    }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/catalog.v1.json'))
        return new Response(catalogFile, { headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/v1/sync')) return json(sync);
      return json({ type: '/problems/not-found', title: 'Não encontrado', status: 404, code: 'not-found' }, 404);
    }),
  );
  await initAuth();
});

async function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('app screens with the prototype demo data', () => {
  it('Painel shows the vehicle, counters, attention list and unregistered chips', async () => {
    await renderAt('/');
    expect(await screen.findByText('Precisa de atenção', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Chevrolet Onix' })).toHaveTextContent('Chevrolet · 2019');
    expect(screen.getByText('Km estimada')).toBeInTheDocument();
    const attention = screen.getByRole('region', { name: 'Precisa de atenção' });
    expect(within(attention).getByText('Correia dentada')).toBeInTheDocument();
    expect(within(attention).getAllByText('Vencido').length).toBeGreaterThan(0);
    expect(screen.getByText('Consultar uma placa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conferir o meu Onix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vencido/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar troca' })).toBeInTheDocument();
  });

  it('Itens groups by category and filters', async () => {
    await renderAt('/itens');
    expect(await screen.findByRole('heading', { name: 'Itens' }, { timeout: 5000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Precisa de atenção' }));
    expect(await screen.findByText('Correia dentada')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar item' }), 'zzzz');
    expect(await screen.findByText('Nenhum item encontrado.')).toBeInTheDocument();
  });

  it('Histórico lists the records with totals and the 12-month notice', async () => {
    await renderAt('/historico');
    expect(await screen.findByRole('heading', { name: 'Histórico' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Trocas registradas')).toBeInTheDocument();
    expect(screen.getByText('Óleo do motor')).toBeInTheDocument();
    expect(
      screen.getByText('O plano grátis mostra os últimos 12 meses. O histórico completo está no Premium.'),
    ).toBeInTheDocument();
  });

  it('Conta shows profile, vehicles and plans', async () => {
    await renderAt('/conta');
    expect(await screen.findByRole('heading', { name: 'Conta' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('rafael@email.com · Plano Grátis')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assinar Premium' })).toBeInTheDocument();
  });

  it('opening the km sheet shows the estimate text', async () => {
    await renderAt('/');
    await screen.findByText('Precisa de atenção', {}, { timeout: 5000 });
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Atualizar km' }));
    });
    const dialog = await screen.findByRole('dialog', { name: 'Atualizar km' });
    expect(within(dialog).getByText('Rodou quanto?')).toBeInTheDocument();
    expect(within(dialog).getByText(/pela sua média de 1\.100 km por mês/)).toBeInTheDocument();
  });
});
