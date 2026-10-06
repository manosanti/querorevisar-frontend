// Business constants from docs/domain.md. Values marked ✏️ there are owner decisions (PENDENCIAS.md).

export const DAY_MS = 864e5;
export const MONTH_DAYS = 30.44;
export const MONTH_MS = MONTH_DAYS * DAY_MS;

export const INITIAL_KM_PER_MONTH = { car: 1100, moto: 900 } as const;

/** Free plan shows the last 12 months of history. */
export const FREE_HISTORY_DAYS = 365;

/** Painel "Sem registro" shows up to 6 of these items when they have no record. */
export const KEY_ITEMS = [
  'Óleo do motor',
  'Filtro de óleo',
  'Filtro de ar',
  'Velas de ignição',
  'Fluido de freio',
  'Pastilhas de freio dianteiras',
  'Correia dentada',
  'Fluido de arrefecimento',
  'Kit relação (corrente, coroa e pinhão)',
] as const;
export const KEY_ITEMS_LIMIT = 6;

/** ✏️ Premium price and monthly credits. */
export const PREMIUM_PRICE_CENTS = 1490;
export const PREMIUM_MONTHLY_CREDITS = 2;

/** ✏️ Single credit price. */
export const CREDIT_UNIT_PRICE_CENTS = 490;

/** Fallback brands/models when FIPE is unavailable (prototype BRANDS). */
export const FALLBACK_BRANDS: Record<'car' | 'moto', Record<string, readonly string[]>> = {
  car: {
    Chevrolet: ['Onix', 'Onix Plus', 'Tracker', 'S10', 'Spin', 'Montana'],
    Volkswagen: ['Gol', 'Polo', 'Virtus', 'T-Cross', 'Nivus', 'Saveiro'],
    Fiat: ['Argo', 'Mobi', 'Cronos', 'Strada', 'Toro', 'Pulse'],
    Hyundai: ['HB20', 'HB20S', 'Creta'],
    Toyota: ['Corolla', 'Corolla Cross', 'Hilux', 'Yaris'],
    Renault: ['Kwid', 'Sandero', 'Duster'],
    Honda: ['City', 'Civic', 'HR-V'],
    Jeep: ['Renegade', 'Compass'],
  },
  moto: {
    Honda: ['CG 160', 'Biz 125', 'Pop 110i', 'CB 300F', 'XRE 300', 'PCX 160'],
    Yamaha: ['Fazer 250', 'Factor 150', 'Lander 250', 'NMax 160'],
    Bajaj: ['Pulsar N150', 'Dominar 200'],
    Suzuki: ['Burgman 125'],
    'Royal Enfield': ['Meteor 350'],
  },
};
