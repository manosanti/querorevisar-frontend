// Vehicle lookups by plate (docs/domain.md#consultas-veiculares). ✏️ Credit costs are owner decisions.
import { CREDIT_UNIT_PRICE_CENTS } from './constants.ts';

export type LookupProductId = 'laudo' | 'restricoes' | 'leilao' | 'debitos' | 'basica' | 'fipe';
export type LookupPart = 'basica' | 'restricoes' | 'leilao' | 'debitos' | 'fipe';
export type Tone = 'ok' | 'warn' | 'over';

export interface LookupProduct {
  id: LookupProductId;
  name: string;
  desc: string;
  credits: number;
  tag?: string;
  parts: LookupPart[];
}

export const LOOKUP_PRODUCTS: readonly LookupProduct[] = [
  {
    id: 'laudo',
    name: 'Laudo cautelar completo',
    desc: 'Tudo abaixo num relatório só, com PDF para levar na negociação.',
    credits: 6,
    tag: 'Antes de comprar',
    parts: ['basica', 'restricoes', 'leilao', 'debitos', 'fipe'],
  },
  {
    id: 'restricoes',
    name: 'Restrições',
    desc: 'Roubo e furto, financiamento, bloqueio judicial.',
    credits: 2,
    parts: ['restricoes'],
  },
  {
    id: 'leilao',
    name: 'Leilão e sinistro',
    desc: 'Passagem por leilão, indenização de seguradora, perda total.',
    credits: 3,
    parts: ['leilao'],
  },
  {
    id: 'debitos',
    name: 'Débitos, IPVA e multas',
    desc: 'Valores em aberto no Detran e na Sefaz.',
    credits: 2,
    parts: ['debitos'],
  },
  {
    id: 'basica',
    name: 'Dados da placa',
    desc: 'Marca, modelo, ano, cor, combustível e município.',
    credits: 1,
    parts: ['basica'],
  },
  { id: 'fipe', name: 'Tabela FIPE', desc: 'Preço médio de mercado do modelo e ano.', credits: 0, parts: ['fipe'] },
];

export function lookupProduct(id: string): LookupProduct {
  return LOOKUP_PRODUCTS.find(p => p.id === id) ?? LOOKUP_PRODUCTS[0]!;
}

/** Price shown next to a product: credits × unit price, or "Grátis". */
export function lookupPriceCents(p: LookupProduct): number {
  return p.credits * CREDIT_UNIT_PRICE_CENTS;
}

export interface LookupRow {
  label: string;
  value: string;
  tone: Tone | null;
}

export interface LookupSection {
  key: string;
  title: string;
  rows: LookupRow[];
}

/** "Nada consta nas bases consultadas" or "N pontos de atenção: a, b". */
export function lookupSummary(sections: readonly LookupSection[]): { flags: number; text: string; tone: Tone } {
  const flags = sections.flatMap(s => s.rows.filter(r => r.tone === 'warn' || r.tone === 'over'));
  if (!flags.length) return { flags: 0, text: 'Nada consta nas bases consultadas', tone: 'ok' };
  const head = flags.length === 1 ? '1 ponto de atenção' : `${flags.length} pontos de atenção`;
  return {
    flags: flags.length,
    text: `${head}: ${flags.map(f => f.label.toLowerCase()).join(', ')}`,
    tone: flags.some(f => f.tone === 'over') ? 'over' : 'warn',
  };
}
