import { describe, expect, it } from 'vitest';
import { historyTotals } from '../src/lib/content.ts';
import {
  CONSENT_STORAGE_KEY,
  isAnalyticsConfigured,
  parseConsent,
  readConsent,
  writeConsent,
} from '../src/lib/consent.ts';
import { isValidEmail } from '../src/lib/email.ts';
import { appUrl, signInUrl } from '../src/lib/links.ts';
import { annualDiscountLabel, lookupViews, packViews, premiumPrice } from '../src/lib/pricing.ts';
import { isNoindex, normalizePath } from '../src/lib/seo.ts';
import { simulateAlert } from '../src/lib/simulator.ts';

// Intl formats BRL with a no-break space after "R$".
const brl = (s: string) => s.replace(/R\$ /g, 'R$\u00a0');

describe('links', () => {
  it('builds app URLs keeping a sub-path of the base', () => {
    expect(appUrl('http://localhost:5173', '/entrar').href).toBe('http://localhost:5173/entrar');
    expect(appUrl('https://example.com/app/', '/entrar').href).toBe('https://example.com/app/entrar');
  });

  it('puts the e-mail in the fragment, never in the query string', () => {
    const url = new URL(signInUrl('http://localhost:5173', { signup: true, email: ' ana@gmail.com ' }));
    expect(url.pathname).toBe('/entrar');
    expect(url.searchParams.get('mode')).toBe('signup');
    expect(url.search).not.toContain('ana');
    expect(new URLSearchParams(url.hash.slice(1)).get('email')).toBe('ana@gmail.com');
  });

  it('adds provider and plan', () => {
    expect(signInUrl('http://localhost:5173', { signup: true, provider: 'google' })).toBe(
      'http://localhost:5173/entrar?mode=signup&provider=google',
    );
    expect(signInUrl('http://localhost:5173', { plan: 'premium' })).toBe('http://localhost:5173/entrar?plan=premium');
    expect(signInUrl('http://localhost:5173')).toBe('http://localhost:5173/entrar');
  });
});

describe('email', () => {
  it('follows the prototype rule', () => {
    expect(isValidEmail('nome@gmail.com')).toBe(true);
    expect(isValidEmail('  nome@gmail.com ')).toBe(true);
    expect(isValidEmail('nome@gmail')).toBe(false);
    expect(isValidEmail('nome@gmail.c')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no me@gmail.com')).toBe(false);
  });
});

describe('alert simulator', () => {
  it('starts like the prototype (8.600 km, 7 meses)', () => {
    expect(simulateAlert(8600, 7)).toEqual({
      tone: 'warn',
      badge: 'Atenção',
      pctLabel: '86%',
      width: '71.67%',
      line: 'faltam 1.400 km',
      why: 'Neste caso a km chegou antes do prazo de 12 meses.',
    });
  });

  it('is on time when far from both limits', () => {
    const a = simulateAlert(0, 0);
    expect([a.tone, a.badge, a.pctLabel, a.line]).toEqual(['ok', 'Em dia', '0%', 'faltam 10.000 km']);
  });

  it('lets time win when it is ahead of the km', () => {
    expect(simulateAlert(1000, 11)).toMatchObject({ tone: 'warn', line: 'faltam 1 mês', pctLabel: '92%' });
    expect(simulateAlert(1000, 13)).toMatchObject({
      tone: 'over',
      badge: 'Vencido',
      line: 'passou 1 mês do prazo',
      why: 'Neste caso o prazo de 12 meses chegou antes da km.',
    });
    expect(simulateAlert(0, 15).line).toBe('passou 3 meses do prazo');
  });

  it('is overdue at exactly 100% and caps the bar at 120%', () => {
    expect(simulateAlert(10000, 0)).toMatchObject({ tone: 'over', line: 'passou 0 km', pctLabel: '100%' });
    expect(simulateAlert(12000, 0).width).toBe('100.00%');
  });
});

describe('pricing', () => {
  it('derives the Premium prices from @qr/core', () => {
    expect(premiumPrice('mensal')).toEqual({ price: brl('R$ 14,90'), per: '/mês', note: 'Cancele quando quiser' });
    expect(premiumPrice('anual')).toEqual({
      price: brl('R$ 149'),
      per: '/ano',
      note: brl('Equivale a R$ 12,42 por mês'),
    });
    expect(annualDiscountLabel).toBe('\u221217%');
  });

  it('lists the credit packs like the prototype sheet', () => {
    expect(packViews.map(p => [p.name, p.unit, p.price, p.off, p.tag])).toEqual([
      ['1 crédito', brl('R$ 4,90 por crédito'), brl('R$ 4,90'), null, null],
      ['5 créditos', brl('R$ 4,38 por crédito'), brl('R$ 21,90'), 'Economia de 11%', null],
      ['12 créditos', brl('R$ 3,99 por crédito'), brl('R$ 47,90'), 'Economia de 19%', 'Mais escolhido'],
      ['30 créditos', brl('R$ 3,50 por crédito'), brl('R$ 104,90'), 'Economia de 29%', null],
    ]);
  });

  it('prices each lookup in credits', () => {
    const byId = Object.fromEntries(lookupViews.map(l => [l.id, l]));
    expect(byId.laudo).toMatchObject({ price: brl('R$ 29,40'), cost: '6 créditos · economiza 2' });
    expect(byId.basica).toMatchObject({ price: brl('R$ 4,90'), cost: '1 crédito' });
    expect(byId.fipe).toMatchObject({ price: 'Grátis', cost: '' });
  });
});

describe('demo history', () => {
  it('totals each place filter', () => {
    expect(historyTotals('todos')).toEqual({ label: '5 trocas', total: brl('R$ 1.607') });
    expect(historyTotals('casa')).toEqual({ label: '2 trocas em casa', total: brl('R$ 258') });
    expect(historyTotals('mec')).toEqual({ label: '3 trocas na oficina', total: brl('R$ 1.349') });
  });
});

describe('consent', () => {
  it('treats placeholders as "no analytics"', () => {
    expect(isAnalyticsConfigured('<SEM_TOKEN>')).toBe(false);
    expect(isAnalyticsConfigured('<PREENCHER>')).toBe(false);
    expect(isAnalyticsConfigured('  ')).toBe(false);
    expect(isAnalyticsConfigured(undefined)).toBe(false);
    expect(isAnalyticsConfigured('phc_abc123')).toBe(true);
  });

  it('reads and writes the stored choice, tolerating blocked storage', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    expect(readConsent(storage)).toBeNull();
    writeConsent(storage, 'granted');
    expect(data.get(CONSENT_STORAGE_KEY)).toBe('granted');
    expect(readConsent(storage)).toBe('granted');
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readConsent(blocked)).toBeNull();
    expect(() => writeConsent(blocked, 'denied')).not.toThrow();
    expect(parseConsent('yes')).toBeNull();
  });
});

describe('seo', () => {
  it('normalizes paths and flags the placeholder legal pages', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/precos.html')).toBe('/precos');
    expect(normalizePath('/termos/')).toBe('/termos');
    expect(isNoindex('/privacidade')).toBe(true);
    expect(isNoindex('/precos')).toBe(false);
  });
});
