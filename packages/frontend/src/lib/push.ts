import { api } from '../api/index.js'

function getVapidPublicKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
}

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function getPermissionState(): PushPermissionState {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission as PushPermissionState
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] as number)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export async function ensureSubscribed(token: string): Promise<PushSubscription | null> {
  const vapid = getVapidPublicKey()
  if (!isPushSupported() || !vapid) return null

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission
  if (permission !== 'granted') return null

  const reg = await getRegistration()
  if (!reg) return null

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    })
  }

  const auth = arrayBufferToBase64Url(sub.getKey('auth'))
  const p256dh = arrayBufferToBase64Url(sub.getKey('p256dh'))
  if (!auth || !p256dh) return null

  await api.push.subscribe(token, {
    endpoint: sub.endpoint,
    auth,
    p256dh,
    userAgent: navigator.userAgent,
  })
  return sub
}

export async function unsubscribeFromPush(token: string): Promise<void> {
  const sub = await getCurrentSubscription()
  if (!sub) return
  try {
    await api.push.unsubscribe(token, sub.endpoint)
  } finally {
    await sub.unsubscribe()
  }
}
