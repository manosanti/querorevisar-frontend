// Fetch mutator used by every generated endpoint. The web app configures it once at startup
// (base URL, token provider). Writes get an Idempotency-Key unless the caller already set one.

import type { Problem } from './generated/model/index.ts';

export type { Problem };

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }
}

/** Thrown when the request never reached the API (offline, DNS, CORS). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Sem conexão');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

interface HttpConfig {
  baseUrl: string;
  getToken: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
}

const config: HttpConfig = { baseUrl: '', getToken: () => null };

export function configureHttp(next: Partial<HttpConfig>): void {
  Object.assign(config, next);
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function fallbackProblem(status: number, title: string): Problem {
  return { type: 'about:blank', title, status, code: status === 401 ? 'unauthorized' : 'internal' } as Problem;
}

export async function customFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  const token = await config.getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (WRITE_METHODS.has(method) && !headers.has('Idempotency-Key')) headers.set('Idempotency-Key', newIdempotencyKey());
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json, application/problem+json');

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${url}`, { ...options, method, headers });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new NetworkError(err);
  }

  if (res.status === 204 || res.status === 304) return undefined as T;
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) config.onUnauthorized?.();
    const problem =
      body && typeof body === 'object' && 'title' in body
        ? (body as Problem)
        : fallbackProblem(res.status, 'Algo deu errado. Tente de novo.');
    throw new ApiError({ ...problem, status: res.status });
  }
  return body as T;
}

export type ErrorType<E> = E;
export type BodyType<B> = B;
