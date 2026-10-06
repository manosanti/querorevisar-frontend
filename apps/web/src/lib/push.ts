// Web Push (F08.1). Permission is only requested after a user action (and only once installed on iOS).
import { api } from '@qr/api-client';
import { env } from '../env.ts';
import { track } from './analytics.ts';
import { isStandalone, needsIosInstallGuide } from './pwa.ts';

export type PushAvailability = 'unsupported' | 'needs-install' | 'denied' | 'enabled' | 'available';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function pushAvailability(): Promise<PushAvailability> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return needsIosInstallGuide() ? 'needs-install' : 'unsupported';
  }
  if (needsIosInstallGuide() && !isStandalone()) return 'needs-install';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'enabled' : 'available';
}

/** Asks permission, subscribes with the VAPID key and stores the subscription in the API. */
export async function enablePush(): Promise<boolean> {
  if (!env.vapidPublicKey) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api.createPushSubscription({
    endpoint: json.endpoint,
    keys: json.keys,
    userAgent: navigator.userAgent.slice(0, 200),
  });
  track('push_enabled');
  return true;
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.deletePushSubscription({ endpoint: sub.endpoint });
  await sub.unsubscribe();
}
