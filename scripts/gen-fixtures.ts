// Generates fixtures/*.json from the reference implementation: the prototype logic in
// docs/reference/QueroRevisar v7 responsivo.dc.html, ported verbatim except Date.now() -> NOW.
// packages/core (TS) and apps/api (Kotlin) must both reproduce these outputs.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW_ISO = '2026-10-06T15:00:00.000Z';
const NOW = Date.parse(NOW_ISO);

// ---- prototype logic (verbatim, NOW injected) --------------------------------------------------
const DAY = 864e5,
  MONTH = 30.44 * DAY;
// Deviation 1: normalize -0 so the exact-limit case reads "Passou 0 km" instead of "Passou -0 km".
const fmt = (n: number) => (Math.round(n) || 0).toLocaleString('pt-BR');
const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const STATUS = {
  over: { label: 'Vencido' },
  warn: { label: 'Atenção' },
  ok: { label: 'Em dia' },
  none: { label: 'Sem registro' },
} as const;
type Item = { id: string; km: number | null; months: number | null };
type Rec = { itemId: string; km: number; date: string | null };
type Veh = { km: number; kmAt: number; kmPerMonth: number };
function estKm(v: Veh) {
  return Math.round(v.km + v.kmPerMonth * Math.max(0, (NOW - v.kmAt) / MONTH));
}
function lastRecord(records: Rec[], itemId: string) {
  return records.filter(r => r.itemId === itemId).sort((a, b) => b.km - a.km)[0] || null;
}
function status(it: Item, est: number, records: Rec[]): any {
  const r = lastRecord(records, it.id);
  if (!r) return { key: 'none', r: null };
  const used = est - r.km;
  const pKm = it.km ? used / it.km : 0;
  const monthsUsed = r.date ? (NOW - new Date(r.date).getTime()) / MONTH : null;
  const pT = r.date && it.months ? (monthsUsed as number) / it.months : 0;
  const pct = Math.max(pKm, pT);
  const key = pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
  const kmLeft = it.km ? it.km - used : null;
  const monthsLeft = r.date && it.months ? it.months - (monthsUsed as number) : null;
  const byTime = pT > pKm;
  return { key, r, pct, kmLeft, monthsLeft, monthsUsed, byTime, dueKm: it.km ? r.km + it.km : null };
}
function timeText(kmLeft: number, kmPerMonth: number) {
  const w = kmLeft / (kmPerMonth / 4.345);
  if (w < 1.5) return 'esta semana';
  if (w < 8) return 'cerca de ' + Math.round(w) + ' semanas';
  return 'cerca de ' + Math.round(w / 4.345) + ' meses';
}
function intervalText(it: Item) {
  const a = it.km ? fmt(it.km) + ' km' : null;
  const b = it.months ? it.months + ' meses' : null;
  return [a, b].filter(Boolean).join(' ou ');
}
function line(it: Item, s: any, kmPerMonth: number) {
  if (s.key === 'none') return 'A cada ' + intervalText(it);
  if (s.key === 'over') {
    if (s.byTime) return 'Trocado há ' + Math.round(s.monthsUsed) + ' meses · limite ' + it.months;
    return 'Passou ' + fmt(-s.kmLeft) + ' km do limite';
  }
  if (s.byTime && s.monthsLeft != null)
    return 'Vence em ~' + Math.max(1, Math.round(s.monthsLeft)) + ' meses pelo tempo';
  // Deviation 2: items without a km interval have no kmLeft; show the interval instead of "Faltam ~0 km".
  if (s.kmLeft == null) return 'A cada ' + intervalText(it);
  return 'Faltam ~' + fmt(s.kmLeft) + ' km · ' + timeText(s.kmLeft, kmPerMonth);
}
function saveKm(v: Veh, records: Rec[], n: number) {
  const maxRec = records.reduce((a, r) => Math.max(a, r.km), 0);
  if (n < maxRec) return { error: 'Km menor que a última troca registrada (' + fmt(maxRec) + ' km)' };
  const months = (NOW - v.kmAt) / MONTH;
  // Deviation 3: kmPerMonth never drops below 1 (avoids division by zero in timeText).
  const kpm = months > 0.5 && n > v.km ? Math.max(1, Math.round((n - v.km) / months)) : v.kmPerMonth;
  return { vehicle: { km: n, kmAt: NOW, kmPerMonth: kpm } };
}
// -------------------------------------------------------------------------------------------------

const iso = (ms: number) => new Date(ms).toISOString();
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const daysAgo = (d: number) => NOW - d * DAY;
const r6 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 1e6) / 1e6);

type CaseIn = {
  name: string;
  vehicle: { type: 'car' | 'moto'; km: number; kmAtDaysAgo: number; kmPerMonth: number };
  item: Item & { name: string };
  records: Array<{ itemId?: string; km: number; dateDaysAgo: number | null }>;
};

const oil = { id: 'm1', name: 'Óleo do motor', km: 10000, months: 12 };
const belt = { id: 'belt', name: 'Correia dentada', km: 60000, months: 48 };
const fluid = { id: 'fluid', name: 'Fluido de freio', km: null, months: 24 };
const level = { id: 'level', name: 'Nível de óleo', km: 1000, months: 1 };
const kmOnly = { id: 'tires', name: 'Pneus', km: 40000, months: null };
const pulsarOil = { id: 'm1', name: 'Óleo do motor (plano Bajaj)', km: 10000, months: 12 };
const pulsarPlug = { id: 'plug', name: 'Velas de ignição (plano Bajaj)', km: 30000, months: 36 };
const pulsarFork = { id: 'fork', name: 'Óleo do garfo (plano Bajaj)', km: 30000, months: 36 };

const car = (km: number, kmAtDaysAgo: number, kmPerMonth = 1100) => ({
  type: 'car' as const,
  km,
  kmAtDaysAgo,
  kmPerMonth,
});
const moto = (km: number, kmAtDaysAgo: number, kmPerMonth = 900) => ({
  type: 'moto' as const,
  km,
  kmAtDaysAgo,
  kmPerMonth,
});

const cases: CaseIn[] = [
  { name: 'sem registro (km e meses)', vehicle: car(48000, 61), item: oil, records: [] },
  { name: 'sem registro (só meses)', vehicle: car(48000, 61), item: fluid, records: [] },
  { name: 'sem registro (só km)', vehicle: car(48000, 61), item: kmOnly, records: [] },
  { name: 'em dia, troca recente', vehicle: car(48000, 0), item: oil, records: [{ km: 47000, dateDaysAgo: 30 }] },
  { name: 'em dia, sem data', vehicle: car(48000, 0), item: oil, records: [{ km: 45000, dateDaysAgo: null }] },
  {
    name: 'em dia, poucas semanas',
    vehicle: car(48000, 0, 2000),
    item: oil,
    records: [{ km: 40500, dateDaysAgo: 90 }],
  },
  { name: 'atenção 80% por km', vehicle: car(48000, 0), item: oil, records: [{ km: 40000, dateDaysAgo: 60 }] },
  { name: 'atenção 85% por km', vehicle: car(48500, 0), item: oil, records: [{ km: 40000, dateDaysAgo: 60 }] },
  { name: 'atenção esta semana', vehicle: car(49700, 0), item: oil, records: [{ km: 40000, dateDaysAgo: 60 }] },
  { name: 'atenção por tempo', vehicle: car(41000, 0), item: oil, records: [{ km: 40000, dateDaysAgo: 320 }] },
  { name: 'vencido por km', vehicle: car(52300, 0), item: oil, records: [{ km: 40000, dateDaysAgo: 100 }] },
  { name: 'vencido por tempo', vehicle: car(43000, 0), item: oil, records: [{ km: 40000, dateDaysAgo: 400 }] },
  {
    name: 'vencido por tempo, só meses',
    vehicle: car(43000, 0),
    item: fluid,
    records: [{ km: 31000, dateDaysAgo: 790 }],
  },
  { name: 'em dia, só meses', vehicle: car(43000, 0), item: fluid, records: [{ km: 31000, dateDaysAgo: 200 }] },
  {
    name: 'só meses sem data fica em dia',
    vehicle: car(43000, 0),
    item: fluid,
    records: [{ km: 31000, dateDaysAgo: null }],
  },
  { name: 'só km, atenção', vehicle: car(70000, 0), item: kmOnly, records: [{ km: 37000, dateDaysAgo: 900 }] },
  {
    name: 'km estimada empurra para vencido',
    vehicle: car(48000, 120, 1100),
    item: oil,
    records: [{ km: 40000, dateDaysAgo: 150 }],
  },
  {
    name: 'km estimada sem tempo decorrido',
    vehicle: car(48000, 0, 1100),
    item: oil,
    records: [{ km: 41500, dateDaysAgo: 172 }],
  },
  { name: 'demo Onix: óleo', vehicle: car(48000, 61, 1100), item: oil, records: [{ km: 41500, dateDaysAgo: 172 }] },
  {
    name: 'demo Onix: correia dentada',
    vehicle: car(48000, 61, 1100),
    item: belt,
    records: [{ km: 10000, dateDaysAgo: 1300 }],
  },
  {
    name: 'vários registros: usa o de maior km',
    vehicle: car(48000, 0),
    item: oil,
    records: [
      { km: 30000, dateDaysAgo: 30 },
      { km: 41000, dateDaysAgo: 400 },
      { km: 35000, dateDaysAgo: 10 },
    ],
  },
  {
    name: 'registro de outro item é ignorado',
    vehicle: car(48000, 0),
    item: oil,
    records: [{ itemId: 'other', km: 47900, dateDaysAgo: 2 }],
  },
  { name: 'moto em dia', vehicle: moto(23100, 20, 950), item: oil, records: [{ km: 21000, dateDaysAgo: 70 }] },
  {
    name: 'moto kit relação vencido por tempo',
    vehicle: moto(23100, 20, 950),
    item: { id: 'kit', name: 'Kit relação', km: 20000, months: 24 },
    records: [{ km: 2500, dateDaysAgo: 900 }],
  },
  {
    name: 'moto nível de óleo vencido',
    vehicle: moto(23100, 20, 950),
    item: level,
    records: [{ km: 21000, dateDaysAgo: 70 }],
  },
  {
    name: 'moto atenção por km',
    vehicle: moto(18300, 0, 900),
    item: oil,
    records: [{ km: 10000, dateDaysAgo: 200 }],
  },
  {
    name: 'plano do fabricante: óleo Pulsar',
    vehicle: moto(15000, 5, 900),
    item: pulsarOil,
    records: [{ km: 6000, dateDaysAgo: 250 }],
  },
  {
    name: 'plano do fabricante: vela Pulsar',
    vehicle: moto(15000, 5, 900),
    item: pulsarPlug,
    records: [{ km: 1000, dateDaysAgo: 500 }],
  },
  {
    name: 'plano do fabricante: garfo Pulsar vencido',
    vehicle: moto(32000, 5, 900),
    item: pulsarFork,
    records: [{ km: 1000, dateDaysAgo: 1200 }],
  },
  {
    name: 'limite exato 100% é vencido',
    vehicle: car(50000, 0),
    item: kmOnly,
    records: [{ km: 10000, dateDaysAgo: null }],
  },
  {
    name: 'meses restantes arredondam para pelo menos 1',
    vehicle: car(40100, 0),
    item: oil,
    records: [{ km: 40000, dateDaysAgo: 360 }],
  },
  {
    name: 'km parada por mais de 3 dias (estimada)',
    vehicle: car(30000, 45, 1500),
    item: belt,
    records: [{ km: 20000, dateDaysAgo: 365 }],
  },
  {
    name: 'carro com média baixa',
    vehicle: car(30000, 30, 300),
    item: oil,
    records: [{ km: 22500, dateDaysAgo: 300 }],
  },
];

const dueCases = cases.map(c => {
  const v: Veh = { km: c.vehicle.km, kmAt: daysAgo(c.vehicle.kmAtDaysAgo), kmPerMonth: c.vehicle.kmPerMonth };
  const records: Rec[] = c.records.map(r => ({
    itemId: r.itemId ?? c.item.id,
    km: r.km,
    date: r.dateDaysAgo == null ? null : dateOnly(daysAgo(r.dateDaysAgo)),
  }));
  const est = estKm(v);
  const s = status(c.item, est, records);
  const pct: number = s.key === 'none' ? 0 : s.pct;
  return {
    name: c.name,
    vehicle: { type: c.vehicle.type, km: v.km, kmAt: iso(v.kmAt), kmPerMonth: v.kmPerMonth },
    item: { id: c.item.id, name: c.item.name, km: c.item.km, months: c.item.months },
    records,
    expected: {
      estimatedKm: est,
      status: s.key,
      recordKm: s.r ? s.r.km : null,
      pct: s.key === 'none' ? null : r6(pct),
      kmLeft: s.key === 'none' ? null : (s.kmLeft ?? null),
      monthsLeft: s.key === 'none' ? null : r6(s.monthsLeft),
      byTime: s.key === 'none' ? false : s.byTime,
      dueKm: s.key === 'none' ? null : s.dueKm,
      line: line(c.item, s, v.kmPerMonth),
      badge: s.key === 'warn' ? Math.round(pct * 100) + '%' : STATUS[s.key as keyof typeof STATUS].label,
      barPct: s.key === 'none' ? 0 : Math.min(100, Math.round(pct * 100)),
      intervalText: intervalText(c.item),
    },
  };
});

const kmCases = [
  { name: 'rejeita km menor que a última troca', vehicle: car(48000, 61), records: [{ km: 47000 }], newKm: 46000 },
  { name: 'recalcula média após 2 meses', vehicle: car(48000, 61), records: [{ km: 41500 }], newKm: 50600 },
  { name: 'mantém média com menos de meio mês', vehicle: car(48000, 10), records: [], newKm: 48500 },
  { name: 'mantém média se o km não subiu', vehicle: car(48000, 90), records: [], newKm: 48000 },
  { name: 'aceita km igual à última troca', vehicle: car(48000, 61), records: [{ km: 47000 }], newKm: 47000 },
  { name: 'moto recalcula média', vehicle: moto(23100, 45), records: [{ km: 21000 }], newKm: 24800 },
  { name: 'média alta após 6 meses', vehicle: car(20000, 183), records: [], newKm: 32000 },
].map(c => {
  const v: Veh = { km: c.vehicle.km, kmAt: daysAgo(c.vehicle.kmAtDaysAgo), kmPerMonth: c.vehicle.kmPerMonth };
  const out = saveKm(
    v,
    c.records.map(r => ({ itemId: 'x', km: r.km, date: null })),
    c.newKm,
  );
  return {
    name: c.name,
    vehicle: { type: c.vehicle.type, km: v.km, kmAt: iso(v.kmAt), kmPerMonth: v.kmPerMonth },
    maxRecordKm: c.records.reduce((a, r) => Math.max(a, r.km), 0),
    newKm: c.newKm,
    expected:
      'error' in out
        ? { error: out.error }
        : { km: out.vehicle.km, kmAt: iso(out.vehicle.kmAt), kmPerMonth: out.vehicle.kmPerMonth },
  };
});

writeFileSync(
  join(root, 'fixtures', 'due-status.json'),
  JSON.stringify({ now: NOW_ISO, monthDays: 30.44, cases: dueCases }, null, 2) + '\n',
);
writeFileSync(
  join(root, 'fixtures', 'km-update.json'),
  JSON.stringify({ now: NOW_ISO, cases: kmCases }, null, 2) + '\n',
);

// ---- vehicle lookup mock provider (prototype cqSections + runCq) ---------------------------------
const CQ_PRODUCTS = [
  { id: 'laudo', parts: ['basica', 'restricoes', 'leilao', 'debitos', 'fipe'] },
  { id: 'restricoes', parts: ['restricoes'] },
  { id: 'leilao', parts: ['leilao'] },
  { id: 'debitos', parts: ['debitos'] },
  { id: 'basica', parts: ['basica'] },
  { id: 'fipe', parts: ['fipe'] },
];
const CQ_CARS: Array<[string, string, string, number]> = [
  ['Volkswagen Polo', '2021', 'Prata', 78512],
  ['Hyundai HB20', '2020', 'Branco', 64230],
  ['Fiat Argo', '2022', 'Cinza', 71890],
  ['Chevrolet Onix Plus', '2021', 'Preto', 76340],
  ['Toyota Corolla', '2019', 'Branco', 104760],
];
const plateHash = (plate: string) => plate.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
function cqSections(q: {
  plate: string;
  product: string;
  mine: boolean;
  model: string;
  year: string;
  color: string;
  fipeCents: number;
}) {
  const flag = q.mine ? -1 : plateHash(q.plate) % 3;
  const prod = CQ_PRODUCTS.find(p => p.id === q.product) || CQ_PRODUCTS[0]!;
  const money = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  const S: Record<string, { key: string; title: string; rows: Array<[string, string, string?]> }> = {
    basica: {
      key: 'basica',
      title: 'Dados do veículo',
      rows: [
        ['Marca e modelo', q.model],
        ['Ano', q.year],
        ['Cor', q.color],
        ['Combustível', 'Flex'],
        ['Município', 'São Paulo/SP'],
      ],
    },
    restricoes: {
      key: 'restricoes',
      title: 'Restrições',
      rows: [
        ['Roubo e furto', 'Nada consta', 'ok'],
        ['Financiamento', 'Nada consta', 'ok'],
        ['Bloqueio judicial', 'Nada consta', 'ok'],
      ],
    },
    leilao: {
      key: 'leilao',
      title: 'Leilão e sinistro',
      rows: [
        ['Leilão', flag === 0 ? 'Consta em 2023' : 'Nada consta', flag === 0 ? 'over' : 'ok'],
        ['Sinistro indenizado', 'Nada consta', 'ok'],
        ['Indício de perda total', 'Nada consta', 'ok'],
      ],
    },
    debitos: {
      key: 'debitos',
      title: 'Débitos',
      rows: [
        ['IPVA 2026', 'Pago', 'ok'],
        ['Licenciamento 2026', 'Pago', 'ok'],
        ['Multas', flag === 1 ? '2 em aberto · R$ 260,32' : 'Nada consta', flag === 1 ? 'warn' : 'ok'],
      ],
    },
    fipe: {
      key: 'fipe',
      title: 'Preço de mercado',
      rows: [
        ['Tabela FIPE', money(q.fipeCents)],
        ['Referência', 'outubro de 2026'],
      ],
    },
  };
  const sections = prod.parts.map(k => ({
    key: S[k]!.key,
    title: S[k]!.title,
    rows: S[k]!.rows.map(r => ({ label: r[0], value: r[1], tone: r[2] ?? null })),
  }));
  const flags = sections.flatMap(s => s.rows.filter(x => x.tone === 'warn' || x.tone === 'over'));
  const summary = flags.length
    ? (flags.length === 1 ? '1 ponto de atenção' : flags.length + ' pontos de atenção') +
      ': ' +
      flags.map(x => x.label.toLowerCase()).join(', ')
    : 'Nada consta nas bases consultadas';
  const tone = flags.length ? (flags.some(x => x.tone === 'over') ? 'over' : 'warn') : 'ok';
  return { sections, summary: { flags: flags.length, text: summary, tone } };
}
const myVehicle = { model: 'Chevrolet Onix', year: '2019', color: 'Prata', fipeCents: 6240000 };
const lookupCases = [
  { plate: 'ABC1D23', product: 'laudo', mine: false },
  { plate: 'BRA2E19', product: 'laudo', mine: false },
  { plate: 'QRV2E19', product: 'debitos', mine: true },
  { plate: 'XYZ9A87', product: 'leilao', mine: false },
  { plate: 'MNO4P56', product: 'debitos', mine: false },
  { plate: 'KLM3N45', product: 'restricoes', mine: false },
  { plate: 'GHI7J89', product: 'basica', mine: false },
  { plate: 'DEF5G67', product: 'fipe', mine: false },
  { plate: 'RST8U90', product: 'laudo', mine: false },
  { plate: 'QRV2E19', product: 'laudo', mine: true },
  { plate: 'ABC1D25', product: 'debitos', mine: false },
  { plate: 'ABC1D25', product: 'laudo', mine: false },
  { plate: 'HJK2L34', product: 'leilao', mine: false },
].map(c => {
  const h = plateHash(c.plate);
  const carRow = CQ_CARS[h % CQ_CARS.length]!;
  const vehicle = c.mine
    ? { model: myVehicle.model, year: myVehicle.year, color: myVehicle.color, fipeCents: myVehicle.fipeCents }
    : { model: carRow[0], year: carRow[1], color: carRow[2], fipeCents: carRow[3] * 100 };
  return { input: c, plateHash: h, vehicle, expected: cqSections({ ...c, ...vehicle }) };
});
writeFileSync(
  join(root, 'fixtures', 'lookup-mock.json'),
  JSON.stringify({ now: NOW_ISO, myVehicle, cases: lookupCases }, null, 2) + '\n',
);

// ---- catalog merge with the manufacturer plan (prototype catalogItems) -----------------------------
const catalog = JSON.parse(readFileSync(join(root, 'data', 'catalog.json'), 'utf8'));
const plans = JSON.parse(readFileSync(join(root, 'data', 'planos.json'), 'utf8')).plans;
function catalogItems(v: { type: string; brand: string; model: string }) {
  // Deviation 4: tolerant plan lookup (FIPE names): same brand ignoring case/accents, model equal or starting with it.
  const fab =
    plans.find(
      (p: any) =>
        norm(p.brand) === norm(v.brand) &&
        (norm(v.model) === norm(p.model) || norm(v.model).startsWith(norm(p.model) + ' ')),
    ) || null;
  const fabMap: Record<string, { km: number; months: number }> = {};
  if (fab)
    fab.categories.forEach((c: any) =>
      c.items.forEach((pi: any) => {
        const r = (pi.rules || []).find((r: any) => (r.acoes || []).indexOf('trocar') >= 0);
        if (r) fabMap[norm(pi.name || pi.nome)] = { km: r.intervaloKm, months: r.intervaloMeses };
      }),
    );
  const out: Array<{ id: string; km: number | null; months: number | null; source: string }> = [];
  catalog.categories.forEach((c: any) =>
    c.items.forEach((it: any) => {
      if (it.types.indexOf(v.type) < 0) return;
      const f = fabMap[norm(it.name)];
      out.push({
        id: it.id,
        km: f ? f.km : it.km,
        months: f ? f.months : it.months,
        source: f ? 'Plano ' + fab.brand : 'Média QueroRevisar',
      });
    }),
  );
  return out;
}
const mergeCases = [
  { type: 'moto', brand: 'Bajaj', model: 'Pulsar N150' },
  { type: 'moto', brand: 'Honda', model: 'CG 160' },
  { type: 'car', brand: 'Chevrolet', model: 'Onix' },
  { type: 'moto', brand: 'BAJAJ', model: 'PULSAR N150 160' },
  { type: 'moto', brand: 'Bajaj', model: 'Pulsar N1500' },
].map(v => {
  const items = catalogItems(v);
  return {
    vehicle: v,
    count: items.length,
    overridden: items.filter(i => i.source !== 'Média QueroRevisar'),
    sample: items.slice(0, 5),
  };
});
writeFileSync(join(root, 'fixtures', 'catalog-merge.json'), JSON.stringify({ cases: mergeCases }, null, 2) + '\n');

console.log(
  `due-status: ${dueCases.length} cases · km-update: ${kmCases.length} · catalog-merge: ${mergeCases.length}`,
);
for (const c of dueCases)
  console.log(`  ${c.expected.status.padEnd(5)} ${c.expected.badge.padEnd(13)} ${c.expected.line}`);
console.log(mergeCases.map(m => `${m.vehicle.model}: ${m.count} itens, ${m.overridden.length} do plano`).join(' | '));
