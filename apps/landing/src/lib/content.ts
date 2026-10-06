// Copy and demo data of the home page, taken verbatim from docs/reference/QueroRevisar Landing.dc.html.
import { fmtInt, moneyShort } from '@qr/core';

export const FREE_FEATURES = [
  '1 veículo',
  'Todos os alertas por km e por tempo',
  'Catálogo completo de 175 itens',
  'Histórico com busca e filtros',
  'Registro em casa ou na oficina',
] as const;

export const PREMIUM_FEATURES = [
  'Tudo do plano grátis',
  'Vários veículos, carro e moto',
  'Sem anúncios',
  'Cadastro do veículo pela placa',
  'Histórico completo e gastos por veículo',
] as const;

export const FAQ: ReadonlyArray<readonly [question: string, answer: string]> = [
  [
    'Preciso saber a data de cada troca?',
    'Não. Para registrar basta o item e o km do painel no dia da troca. Data, local e valor são opcionais.',
  ],
  [
    'De onde vêm os intervalos de cada item?',
    'De médias pesquisadas por item e por tipo de veículo. Quando o plano de manutenção do fabricante está cadastrado para o seu modelo, ele tem prioridade.',
  ],
  [
    'Como o app sabe a km do meu veículo?',
    'Você atualiza a km do painel quando quiser. Entre uma atualização e outra, o app estima a km pela média que você roda por mês.',
  ],
  [
    'Serve para quem leva na oficina?',
    'Sim. Marque se a troca foi em casa ou na oficina e, se quiser, informe o valor. O histórico separa os dois.',
  ],
  [
    'O plano grátis limita os alertas?',
    'Não. Todos os alertas por km e por tempo aparecem no plano grátis. O Premium libera mais de um veículo, remove anúncios e adiciona o cadastro por placa.',
  ],
  [
    'Funciona para moto?',
    'Sim. O catálogo se ajusta ao tipo de veículo, com itens próprios de moto como kit relação e lubrificação da corrente.',
  ],
];

export type VehicleKind = 'car' | 'moto';

export interface ShowcaseVehicle {
  kind: VehicleKind;
  tab: string;
  name: string;
  sub: string;
  items: ReadonlyArray<{ name: string; cat: string; every: string }>;
}

const items = (rows: ReadonlyArray<readonly [string, string, string]>) =>
  rows.map(([name, cat, every]) => ({ name, cat, every }));

export const VEHICLES: readonly ShowcaseVehicle[] = [
  {
    kind: 'car',
    tab: 'Carro',
    name: 'Corolla XEi',
    sub: 'Toyota · 2019 · 48.320 km',
    items: items([
      ['Óleo do motor', 'Motor', '10.000 km · 12 meses'],
      ['Correia dentada', 'Motor', '60.000 km · 48 meses'],
      ['Velas de ignição', 'Ignição', '20.000 km · 24 meses'],
      ['Rodízio de pneus', 'Pneus', '10.000 km · 12 meses'],
      ['Fluido de freio', 'Freios', '20.000 km · 24 meses'],
    ]),
  },
  {
    kind: 'moto',
    tab: 'Moto',
    name: 'CB 500F',
    sub: 'Honda · 2021 · 21.480 km',
    items: items([
      ['Óleo do motor', 'Motor', '10.000 km · 12 meses'],
      ['Kit relação', 'Transmissão', '25.000 km · 36 meses'],
      ['Lubrificação da corrente', 'Transmissão', '500 km · 1 mês'],
      ['Corrente: limpeza e ajuste', 'Transmissão', '5.000 km · 6 meses'],
      ['Fluido de freio', 'Freios', '20.000 km · 24 meses'],
    ]),
  },
];

/** 24×24 stroke icons used by the demo history rows. */
export const ICON_PATHS = {
  drop: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
  disc: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  belt: 'M6 12a4 4 0 1 0 0 .01M18 12a4 4 0 1 0 0 .01M6 8h12M6 16h12',
} as const;

export type Place = 'casa' | 'mec';
export type PlaceFilter = 'todos' | Place;

export interface HistoryEntry {
  name: string;
  km: number;
  place: Place;
  costCents: number;
  icon: keyof typeof ICON_PATHS;
  date: string;
}

export const HISTORY: readonly HistoryEntry[] = [
  { name: 'Óleo do motor + filtro', km: 48000, place: 'mec', costCents: 38900, icon: 'drop', date: 'ago 2026' },
  { name: 'Pastilhas de freio dianteiras', km: 45200, place: 'casa', costCents: 16200, icon: 'disc', date: 'mai 2026' },
  { name: 'Velas de ignição', km: 40000, place: 'casa', costCents: 9600, icon: 'zap', date: 'jan 2026' },
  { name: 'Correia dentada', km: 38500, place: 'mec', costCents: 82000, icon: 'belt', date: 'nov 2025' },
  { name: 'Fluido de freio', km: 30100, place: 'mec', costCents: 14000, icon: 'drop', date: 'mar 2025' },
];

export const PLACE_CHIPS: ReadonlyArray<{ key: PlaceFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'casa', label: 'Em casa' },
  { key: 'mec', label: 'Oficina' },
];

export function historySub(h: HistoryEntry): string {
  return `${fmtInt(h.km)} km · ${h.place === 'casa' ? 'Em casa' : 'Oficina'} · ${h.date}`;
}

export function historyCost(h: HistoryEntry): string {
  return moneyShort(h.costCents);
}

export interface HistoryTotals {
  label: string;
  total: string;
}

/** Footer of the demo history card for a place filter ("5 trocas" / "R$ 1.607"). */
export function historyTotals(place: PlaceFilter): HistoryTotals {
  const rows = HISTORY.filter(h => place === 'todos' || h.place === place);
  const total = rows.reduce((sum, h) => sum + h.costCents, 0);
  const suffix = place === 'casa' ? ' em casa' : place === 'mec' ? ' na oficina' : '';
  return {
    label: `${rows.length}${rows.length === 1 ? ' troca' : ' trocas'}${suffix}`,
    total: moneyShort(total),
  };
}

export type StatusTone = 'ok' | 'warn' | 'over';

export const PHONE_ITEMS: ReadonlyArray<{ name: string; line: string; badge: string; tone: StatusTone; w: string }> = [
  { name: 'Correia dentada', line: 'passou 1.200 km', badge: 'Vencido', tone: 'over', w: '100%' },
  { name: 'Óleo do motor', line: 'faltam 1.680 km', badge: 'Atenção', tone: 'warn', w: '83%' },
  { name: 'Velas de ignição', line: 'faltam 2.900 km', badge: 'Atenção', tone: 'warn', w: '86%' },
];

export const PHONE_TABS: ReadonlyArray<{ label: string; d: string }> = [
  { label: 'Painel', d: 'M3.05 13a9 9 0 1 1 17.9 0M12 14 18 8' },
  { label: 'Itens', d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { label: 'Histórico', d: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2' },
  { label: 'Conta', d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
];
