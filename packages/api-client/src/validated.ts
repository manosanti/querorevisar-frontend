// Every response the web consumes is validated against the generated Zod schema (docs/PLAN.json F06.3).
// A mismatch means the API drifted from the contract: it is reported as a ContractError instead of
// silently flowing into the local state.
import * as ep from './generated/endpoints/index.ts';
import {
  CancelPremiumResponse,
  CreateCreditPurchaseResponse,
  CreateLookupResponse,
  DevAuthAnonymousResponse,
  DevAuthOauthResponse,
  DevAuthSigninResponse,
  DevAuthSignupResponse,
  ExportMeResponse,
  GetCreditPurchaseResponse,
  GetLookupResponse,
  GetMeResponse,
  GetSyncResponse,
  GetVehicleFipeResponse,
  ListCreditPacksResponse,
  ListFipeBrandsResponse,
  ListFipeModelsResponse,
  ListFipeYearsResponse,
  ListLookupProductsResponse,
  PostSyncResponse,
  StartPremiumCheckoutResponse,
} from './generated/zod/index.zod.ts';

interface Schema {
  safeParse(data: unknown): { success: true } | { success: false; error: { message: string } };
}

export class ContractError extends Error {
  constructor(operation: string, detail: string) {
    super(`Resposta inesperada da API em ${operation}`);
    this.name = 'ContractError';
    this.cause = detail;
  }
}

function validated<A extends unknown[], R>(operation: string, fn: (...args: A) => Promise<R>, schema: Schema) {
  return async (...args: A): Promise<R> => {
    const data = await fn(...args);
    if (data === undefined) return data;
    const result = schema.safeParse(data);
    if (!result.success) throw new ContractError(operation, result.error.message);
    return data;
  };
}

export const api = {
  getSync: validated('getSync', ep.getSync, GetSyncResponse),
  postSync: validated('postSync', ep.postSync, PostSyncResponse),
  getMe: validated('getMe', ep.getMe, GetMeResponse),
  exportMe: validated('exportMe', ep.exportMe, ExportMeResponse),
  deleteMe: ep.deleteMe,
  getVehicleFipe: validated('getVehicleFipe', ep.getVehicleFipe, GetVehicleFipeResponse),
  listFipeBrands: validated('listFipeBrands', ep.listFipeBrands, ListFipeBrandsResponse),
  listFipeModels: validated('listFipeModels', ep.listFipeModels, ListFipeModelsResponse),
  listFipeYears: validated('listFipeYears', ep.listFipeYears, ListFipeYearsResponse),
  listLookupProducts: validated('listLookupProducts', ep.listLookupProducts, ListLookupProductsResponse),
  createLookup: validated('createLookup', ep.createLookup, CreateLookupResponse),
  getLookup: validated('getLookup', ep.getLookup, GetLookupResponse),
  listCreditPacks: validated('listCreditPacks', ep.listCreditPacks, ListCreditPacksResponse),
  createCreditPurchase: validated('createCreditPurchase', ep.createCreditPurchase, CreateCreditPurchaseResponse),
  getCreditPurchase: validated('getCreditPurchase', ep.getCreditPurchase, GetCreditPurchaseResponse),
  startPremiumCheckout: validated('startPremiumCheckout', ep.startPremiumCheckout, StartPremiumCheckoutResponse),
  cancelPremium: validated('cancelPremium', ep.cancelPremium, CancelPremiumResponse),
  approveMockPayment: ep.approveMockPayment,
  createPushSubscription: ep.createPushSubscription,
  deletePushSubscription: ep.deletePushSubscription,
  devAuthAnonymous: validated('devAuthAnonymous', ep.devAuthAnonymous, DevAuthAnonymousResponse),
  devAuthSignup: validated('devAuthSignup', ep.devAuthSignup, DevAuthSignupResponse),
  devAuthSignin: validated('devAuthSignin', ep.devAuthSignin, DevAuthSigninResponse),
  devAuthOauth: validated('devAuthOauth', ep.devAuthOauth, DevAuthOauthResponse),
  devAuthRecover: ep.devAuthRecover,
};
