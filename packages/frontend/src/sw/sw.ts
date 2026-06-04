/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

setDefaultHandler(new NetworkOnly())

const navigationHandler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(
  async (params) => {
    try {
      return await navigationHandler(params)
    } catch {
      const cache = await caches.match('/offline.html')
      if (cache) return cache
      return Response.error()
    }
  },
  {
    denylist: [/^\/api\//, /^\/auth\//, /\/sse(\/|$)/, /\/events(\/|$)/],
  },
)
registerRoute(navigationRoute)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

interface PushPayload {
  title: string
  body: string
  url?: string
  badge?: string
  tag?: string
  logId?: string
}

self.addEventListener('push', (event) => {
  const fallback: PushPayload = { title: 'VB Tippjáték', body: '' }
  let payload: PushPayload = fallback
  if (event.data) {
    try {
      const parsed = event.data.json() as Partial<PushPayload>
      payload = {
        title: typeof parsed.title === 'string' && parsed.title.length > 0 ? parsed.title : fallback.title,
        body: typeof parsed.body === 'string' ? parsed.body : '',
        url: typeof parsed.url === 'string' ? parsed.url : undefined,
        badge: typeof parsed.badge === 'string' ? parsed.badge : undefined,
        tag: typeof parsed.tag === 'string' ? parsed.tag : undefined,
        logId: typeof parsed.logId === 'string' ? parsed.logId : undefined,
      }
    } catch {
      const text = event.data.text()
      payload = { ...fallback, body: text }
    }
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: payload.badge ?? '/icon-192.png',
    tag: payload.tag,
    data: { url: payload.url ?? '/', logId: payload.logId },
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as { url?: string; logId?: string }
  const targetUrl = typeof data.url === 'string' && data.url.length > 0 ? data.url : '/'
  const logId = typeof data.logId === 'string' ? data.logId : null

  event.waitUntil((async () => {
    if (logId) {
      try {
        await fetch('/api/push/clicked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId }),
          keepalive: true,
        })
      } catch {
        // best-effort
      }
    }

    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      try {
        const url = new URL(client.url)
        if (url.pathname === targetUrl || url.pathname + url.search === targetUrl) {
          await client.focus()
          return
        }
      } catch {
        // ignore parse errors
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl)
    }
  })())
})
