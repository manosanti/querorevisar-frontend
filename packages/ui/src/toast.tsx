// Toast at the top, centered, up to 448px (docs/design-system.md). Success uses --success, errors --over-fg.
import { useSyncExternalStore } from 'react';
import { cn } from './cn.ts';

export type ToastKind = 'ok' | 'err';
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

let current: ToastState | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Shows a toast with the exact prototype text. Errors stay 3.2 s, success 2.2 s. */
export function toast(message: string, kind: ToastKind = 'ok'): void {
  clearTimeout(timer);
  current = { id: ++seq, message, kind };
  emit();
  timer = setTimeout(
    () => {
      current = null;
      emit();
    },
    kind === 'err' ? 3200 : 2200,
  );
}

export function dismissToast(): void {
  clearTimeout(timer);
  current = null;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useToastState(): ToastState | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

export function ToastViewport() {
  const t = useToastState();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 left-1/2 z-40 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2"
    >
      {t ? (
        <div
          key={t.id}
          role={t.kind === 'err' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 rounded-14 px-4 py-3 text-[14.5px] font-medium text-white shadow-toast',
            t.kind === 'err' ? 'bg-over-fg' : 'bg-success',
          )}
        >
          <span
            aria-hidden="true"
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-on-dark-soft text-[13px] font-bold"
          >
            {t.kind === 'err' ? '!' : '✓'}
          </span>
          <span className="min-w-0">{t.message}</span>
        </div>
      ) : null}
    </div>
  );
}
