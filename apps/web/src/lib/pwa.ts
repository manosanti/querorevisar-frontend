// PWA lifecycle (F07): service worker with "Nova versão disponível", guided install and persistent storage.
import { create } from 'zustand';
import { track } from './analytics.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  updateReady: boolean;
  installEvent: BeforeInstallPromptEvent | null;
  applyUpdate: () => void;
}

export const usePwa = create<PwaState>(() => ({ updateReady: false, installEvent: null, applyUpdate: () => {} }));

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad Safari, not installed: needs the manual "Compartilhar → Adicionar à Tela de Início". */
export function needsIosInstallGuide(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && safari && !isStandalone();
}

export async function startPwa(): Promise<void> {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    usePwa.setState({ installEvent: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    usePwa.setState({ installEvent: null });
    track('pwa_installed');
    void navigator.storage?.persist?.();
  });
  if (isStandalone()) void navigator.storage?.persist?.();

  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  const updateSW = registerSW({
    onNeedRefresh() {
      usePwa.setState({ updateReady: true, applyUpdate: () => void updateSW(true) });
    },
  });
}

export async function promptInstall(): Promise<boolean> {
  const ev = usePwa.getState().installEvent;
  if (!ev) return false;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  usePwa.setState({ installEvent: null });
  return outcome === 'accepted';
}
