import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Km count-up when the Painel opens: 0 → target in 1.3 s with a quartic ease-out. */
export function useCountUp(target: number, replayKey: number): number {
  const [value, setValue] = useState<number | null>(prefersReducedMotion() ? null : 0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(null);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const D = 1300;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      const e = 1 - Math.pow(1 - k, 4);
      setValue(k < 1 ? Math.round(targetRef.current * e) : null);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const start = setTimeout(() => {
      setValue(0);
      raf = requestAnimationFrame(step);
    }, 250);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
    };
  }, [replayKey]);

  return value ?? target;
}

/** Touch pull-to-refresh on the Painel (mobile). Returns the pull distance and the busy flag. */
export function usePullToRefresh(enabled: boolean, onRefresh: () => Promise<void>) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const pulled = useRef(false);
  const pullRef = useRef(0);
  pullRef.current = pull;

  useEffect(() => {
    if (!enabled) return;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    const down = (e: TouchEvent) => {
      if (busy || !atTop() || document.body.style.overflow === 'hidden') return;
      startY.current = e.touches[0]?.clientY ?? null;
      pulled.current = false;
    };
    const move = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        if (pulled.current) setPull(0);
        return;
      }
      if (!pulled.current && dy < 6) return;
      pulled.current = true;
      if (e.cancelable) e.preventDefault();
      setDragging(true);
      setPull(Math.min(120, Math.round(dy * 0.5)));
    };
    const up = () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (!pulled.current) return;
      if (pullRef.current >= 64) {
        setPull(56);
        setBusy(true);
        const minDelay = new Promise(r => setTimeout(r, 700));
        void Promise.allSettled([onRefresh(), minDelay]).finally(() => {
          setPull(0);
          setBusy(false);
        });
      } else setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [enabled, busy, onRefresh]);

  return { pull, dragging, busy };
}
