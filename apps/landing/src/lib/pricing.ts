// Prices shown on the landing, derived from @qr/core (docs/domain.md#planos and #créditos).
import {
  CREDIT_PACKS,
  LOOKUP_PRODUCTS,
  PREMIUM_MONTHLY_CREDITS,
  PREMIUM_PRICE_CENTS,
  credTxt,
  discountPct,
  lookupPriceCents,
  money,
  moneyShort,
  unitPriceCents,
} from '@qr/core';

export type Billing = 'mensal' | 'anual';

/**
 * Annual Premium from the landing prototype: R$ 149/ano = 10 × the monthly price (17% off, "R$ 12,42 por mês").
 * docs/domain.md and the Mercado Pago plan only define the monthly price, so this is an owner decision
 * (PENDENCIAS.md) and the toggle sits behind FEATURES.annualBilling.
 */
export const ANNUAL_MONTHS_CHARGED = 10;

export interface PremiumPrice {
  price: string;
  per: string;
  note: string;
}

export function premiumPrice(billing: Billing): PremiumPrice {
  if (billing === 'anual') {
    const annual = PREMIUM_PRICE_CENTS * ANNUAL_MONTHS_CHARGED;
    return { price: moneyShort(annual), per: '/ano', note: `Equivale a ${money(Math.round(annual / 12))} por mês` };
  }
  return { price: money(PREMIUM_PRICE_CENTS), per: '/mês', note: 'Cancele quando quiser' };
}

/** Discount badge of the annual toggle, written with U+2212 MINUS SIGN as in the prototype. */
export const annualDiscountLabel = `\u2212${Math.round((1 - ANNUAL_MONTHS_CHARGED / 12) * 100)}%`;

/** "R$ 14,90/mês" */
export const premiumMonthlyLabel = `${money(PREMIUM_PRICE_CENTS)}/mês`;

export interface PackView {
  id: string;
  name: string;
  unit: string;
  price: string;
  off: string | null;
  tag: string | null;
}

export const packViews: readonly PackView[] = CREDIT_PACKS.map(p => {
  const off = discountPct(p);
  return {
    id: p.id,
    name: credTxt(p.credits),
    unit: `${money(unitPriceCents(p))} por crédito`,
    price: money(p.priceCents),
    off: off > 0 ? `Economia de ${off}%` : null,
    tag: p.tag ?? null,
  };
});

export interface LookupView {
  id: string;
  name: string;
  desc: string;
  tag: string | null;
  price: string;
  cost: string;
}

/** Credits saved by a bundle compared with buying its parts one by one ("economiza 2" on the laudo). */
function bundleSaving(id: string): number {
  const product = LOOKUP_PRODUCTS.find(p => p.id === id);
  if (!product || product.parts.length < 2) return 0;
  const parts = LOOKUP_PRODUCTS.filter(p => p.id !== id && p.parts.length === 1 && product.parts.includes(p.parts[0]!));
  return parts.reduce((sum, p) => sum + p.credits, 0) - product.credits;
}

export const lookupViews: readonly LookupView[] = LOOKUP_PRODUCTS.map(p => {
  const saving = bundleSaving(p.id);
  return {
    id: p.id,
    name: p.name,
    desc: p.desc,
    tag: p.tag ?? null,
    price: p.credits ? money(lookupPriceCents(p)) : 'Grátis',
    cost: p.credits ? credTxt(p.credits) + (saving > 0 ? ` · economiza ${saving}` : '') : '',
  };
});

const paidCredits = LOOKUP_PRODUCTS.map(p => p.credits).filter(c => c > 0);

/** "Cada consulta custa de 1 a 6 créditos." (copy of the app's credit sheet, numbers from LOOKUP_PRODUCTS) */
export const lookupCostLine = `Cada consulta custa de ${Math.min(...paidCredits)} a ${Math.max(...paidCredits)} créditos. Pacotes saem mais barato que o avulso.`;

/** "No Premium você ganha 2 créditos de consulta todo mês." */
export const premiumCreditsLine = `No Premium você ganha ${PREMIUM_MONTHLY_CREDITS} créditos de consulta todo mês.`;
