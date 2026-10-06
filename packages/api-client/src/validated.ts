// Every response the web consumes is validated against the generated Zod schema (docs/PLAN.json F06.3).
// A mismatch means the API drifted from the contract: it is reported as a ContractError instead of
// silently flowing into the local state. Zod and the schemas load on the first API call, in parallel with
// the request, so they stay out of the initial bundle.
import * as ep from './generated/endpoints/index.ts';
import type * as Schemas from './generated/zod/index.zod.ts';

type SchemaModule = typeof Schemas;
type SchemaName = {
  [K in keyof SchemaModule]: SchemaModule[K] extends { safeParse: (d: unknown) => unknown } ? K : never;
}[keyof SchemaModule];

let schemas: Promise<SchemaModule> | null = null;
const loadSchemas = () => (schemas ??= import('./generated/zod/index.zod.ts'));

export class ContractError extends Error {
  constructor(operation: string, detail: string) {
    super(`Resposta inesperada da API em ${operation}`);
    this.name = 'ContractError';
    this.cause = detail;
  }
}

function validated<A extends unknown[], R>(operation: string, fn: (...args: A) => Promise<R>, schema: SchemaName) {
  return async (...args: A): Promise<R> => {
    const [data, mod] = await Promise.all([fn(...args), loadSchemas()]);
    if (data === undefined) return data;
    const result = (
      mod[schema] as { safeParse: (d: unknown) => { success: boolean; error?: { message: string } } }
    ).safeParse(data);
    if (!result.success) throw new ContractError(operation, result.error?.message ?? 'invalid');
    return data;
  };
}

export const api = {
  getSync: validated('getSync', ep.getSync, 'GetSyncResponse'),
  postSync: validated('postSync', ep.postSync, 'PostSyncResponse'),
  getMe: validated('getMe', ep.getMe, 'GetMeResponse'),
  exportMe: validated('exportMe', ep.exportMe, 'ExportMeResponse'),
  deleteMe: ep.deleteMe,
  getVehicleFipe: validated('getVehicleFipe', ep.getVehicleFipe, 'GetVehicleFipeResponse'),
  listFipeBrands: validated('listFipeBrands', ep.listFipeBrands, 'ListFipeBrandsResponse'),
  listFipeModels: validated('listFipeModels', ep.listFipeModels, 'ListFipeModelsResponse'),
  listFipeYears: validated('listFipeYears', ep.listFipeYears, 'ListFipeYearsResponse'),
  listLookupProducts: validated('listLookupProducts', ep.listLookupProducts, 'ListLookupProductsResponse'),
  createLookup: validated('createLookup', ep.createLookup, 'CreateLookupResponse'),
  getLookup: validated('getLookup', ep.getLookup, 'GetLookupResponse'),
  listCreditPacks: validated('listCreditPacks', ep.listCreditPacks, 'ListCreditPacksResponse'),
  createCreditPurchase: validated('createCreditPurchase', ep.createCreditPurchase, 'CreateCreditPurchaseResponse'),
  getCreditPurchase: validated('getCreditPurchase', ep.getCreditPurchase, 'GetCreditPurchaseResponse'),
  startPremiumCheckout: validated('startPremiumCheckout', ep.startPremiumCheckout, 'StartPremiumCheckoutResponse'),
  cancelPremium: validated('cancelPremium', ep.cancelPremium, 'CancelPremiumResponse'),
  approveMockPayment: ep.approveMockPayment,
  createPushSubscription: ep.createPushSubscription,
  deletePushSubscription: ep.deletePushSubscription,
  devAuthAnonymous: validated('devAuthAnonymous', ep.devAuthAnonymous, 'DevAuthAnonymousResponse'),
  devAuthSignup: validated('devAuthSignup', ep.devAuthSignup, 'DevAuthSignupResponse'),
  devAuthSignin: validated('devAuthSignin', ep.devAuthSignin, 'DevAuthSigninResponse'),
  devAuthOauth: validated('devAuthOauth', ep.devAuthOauth, 'DevAuthOauthResponse'),
  devAuthRecover: ep.devAuthRecover,
};
