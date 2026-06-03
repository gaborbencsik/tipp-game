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

// PUSH-001 ide illeszti be a webpush logikát
self.addEventListener('push', () => {
  // Stub: PUSH-001 fogja kitölteni
})

// PUSH-001 ide illeszti be a notification kattintás kezelést
self.addEventListener('notificationclick', () => {
  // Stub: PUSH-001 fogja kitölteni
})
