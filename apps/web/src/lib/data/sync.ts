// Sync engine: GET /v1/sync for pulls, an IndexedDB outbox for writes (POST /v1/sync in batches).
// Writes are optimistic: the outbox is re-applied on top of every pull until the server confirms it.
import { api, NetworkError } from '@qr/api-client';
import { toast } from '@qr/ui';
import { useQuery } from '@tanstack/react-query';
import { createStore, del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { env } from '../../env.ts';
import { useAuth } from '../auth/store.ts';
import { qk, queryClient } from './query.ts';
import { applyAll, applyMutation, emptyState, mergeSync, type LocalState, type OutboxMutation } from './state.ts';

const outboxStore = typeof indexedDB === 'undefined' ? undefined : createStore('qr-outbox', 'mutations');
const outboxKey = (userId: string) => `outbox:${userId}`;
const BATCH = 200;

interface SyncStatus {
  pending: number;
  syncing: boolean;
  online: boolean;
}

export const useSyncStatus = create<SyncStatus>(() => ({
  pending: 0,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
}));

let memory: { userId: string; items: OutboxMutation[] } | null = null;

async function loadOutbox(userId: string): Promise<OutboxMutation[]> {
  if (memory?.userId === userId) return memory.items;
  const items = ((await get(outboxKey(userId), outboxStore)) as OutboxMutation[] | undefined) ?? [];
  memory = { userId, items };
  useSyncStatus.setState({ pending: items.length });
  return items;
}

async function saveOutbox(userId: string, items: OutboxMutation[]): Promise<void> {
  memory = { userId, items };
  useSyncStatus.setState({ pending: items.length });
  await set(outboxKey(userId), items, outboxStore);
}

export async function clearOutbox(userId: string): Promise<void> {
  memory = null;
  useSyncStatus.setState({ pending: 0 });
  await del(outboxKey(userId), outboxStore);
}

/** Pulls changes since the stored cursor (or everything) and rebases the pending outbox on top. */
async function pull(userId: string, opts: { full?: boolean } = {}): Promise<LocalState> {
  const key = qk.sync(userId);
  const prev = queryClient.getQueryData<LocalState>(key);
  const res = await api.getSync(opts.full || !prev?.cursor ? undefined : { since: prev.cursor });
  const merged = mergeSync(opts.full ? undefined : prev, res);
  return applyAll(merged, await loadOutbox(userId));
}

export function useSyncState() {
  const userId = useAuth(s => s.session?.user.id ?? null);
  return useQuery({
    queryKey: qk.sync(userId ?? 'anon'),
    queryFn: () => pull(userId!),
    enabled: !!userId,
    networkMode: 'offlineFirst',
  });
}

let flushing: Promise<void> | null = null;

/** Sends the outbox in batches; on rejections shows the problem and reloads the full state (rollback). */
export function flushOutbox(): Promise<void> {
  const userId = useAuth.getState().session?.user.id;
  if (!userId) return Promise.resolve();
  if (flushing) return flushing;
  flushing = (async () => {
    useSyncStatus.setState({ syncing: true });
    let needsFull = false;
    let sent = false;
    try {
      let queue = await loadOutbox(userId);
      while (queue.length && navigator.onLine) {
        const batch = queue.slice(0, BATCH);
        const res = await api.postSync({
          mutations: batch.map(m => ({ ...m, payload: m.payload as unknown as Record<string, unknown> })),
        });
        sent = true;
        const done = new Set([...res.applied, ...res.rejected.map(r => r.id)]);
        queue = (await loadOutbox(userId)).filter(m => !done.has(m.id));
        await saveOutbox(userId, queue);
        const first = res.rejected[0];
        if (first) {
          needsFull = true;
          toast(first.problem.title, 'err');
        }
      }
      if (sent || needsFull) await refreshState({ full: needsFull });
    } catch (err) {
      if (!(err instanceof NetworkError)) console.warn('[sync] flush failed', err);
    } finally {
      useSyncStatus.setState({ syncing: false });
      flushing = null;
    }
  })();
  return flushing;
}

/** Re-pulls from the API into the cache (pull-to-refresh, after purchases, after a flush). */
export async function refreshState(opts: { full?: boolean } = {}): Promise<void> {
  const userId = useAuth.getState().session?.user.id;
  if (!userId) return;
  try {
    const next = await pull(userId, opts);
    queryClient.setQueryData(qk.sync(userId), next);
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
  }
}

/** Optimistic write: apply locally, persist in the outbox, then try to send right away. */
export async function enqueue(mutation: OutboxMutation): Promise<void> {
  const userId = useAuth.getState().session?.user.id;
  if (!userId) throw new Error('No session');
  const key = qk.sync(userId);
  // The in-memory outbox is updated synchronously, so a pull finishing right now already rebases on it.
  const saving = saveOutbox(userId, [...(await loadOutbox(userId)), mutation]);
  queryClient.setQueryData<LocalState>(key, prev => applyMutation(prev ?? emptyState(env.catalogVersion), mutation));
  await saving;
  void flushOutbox();
}

/** Flush when the network comes back, when the app opens and every 30 s while something is pending. */
export function startSyncLoop(): () => void {
  const onOnline = () => {
    useSyncStatus.setState({ online: true });
    void flushOutbox();
  };
  const onOffline = () => useSyncStatus.setState({ online: false });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const timer = setInterval(() => {
    if (useSyncStatus.getState().pending > 0) void flushOutbox();
  }, 30_000);
  const unsub = useAuth.subscribe((s, prev) => {
    if (s.session?.user.id && s.session.user.id !== prev.session?.user.id) {
      memory = null;
      void loadOutbox(s.session.user.id).then(() => flushOutbox());
    }
  });
  void flushOutbox();
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    clearInterval(timer);
    unsub();
  };
}
