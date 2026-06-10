import { ref, watch, onUnmounted, type Ref } from 'vue'

export interface MatchUpdateEvent {
  readonly matchId: string
  readonly status: 'scheduled' | 'live' | 'finished' | 'cancelled'
  readonly homeScore: number | null
  readonly awayScore: number | null
  readonly updatedAt: string
}

export interface MatchEventsOptions {
  readonly onMatchUpdate: (event: MatchUpdateEvent) => void
}

export interface MatchEventsHandle {
  readonly isConnected: Ref<boolean>
  readonly disconnect: () => void
}

const SSE_ENABLED = import.meta.env['VITE_USE_SSE_EVENTS'] === 'true'
const API_BASE = (import.meta.env['VITE_API_URL'] ?? '') as string

/**
 * Opens a Server-Sent Events connection to /api/events and forwards
 * match.update payloads to the supplied callback. The browser handles
 * automatic reconnect with the retry hint sent by the server.
 *
 * The connection is gated behind VITE_USE_SSE_EVENTS so the legacy polling
 * path stays the default until SSE is verified in production.
 */
export function useMatchEvents(
  token: Ref<string | null>,
  options: MatchEventsOptions,
): MatchEventsHandle {
  const isConnected = ref(false)
  let source: EventSource | null = null

  function disconnect(): void {
    if (source) {
      source.close()
      source = null
    }
    isConnected.value = false
  }

  function connect(jwt: string): void {
    disconnect()
    const url = `${API_BASE}/api/events?token=${encodeURIComponent(jwt)}`
    source = new EventSource(url)

    source.onopen = (): void => {
      isConnected.value = true
    }

    source.onerror = (): void => {
      // The browser will auto-reconnect using the retry hint. We just
      // surface the disconnect so the polling fallback can take over.
      isConnected.value = false
    }

    source.addEventListener('match.update', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data) as MatchUpdateEvent
        options.onMatchUpdate(payload)
      } catch {
        // Malformed payload — ignore; the next event will work.
      }
    })
  }

  if (SSE_ENABLED) {
    watch(
      token,
      (next) => {
        if (next) connect(next)
        else disconnect()
      },
      { immediate: true },
    )
  }

  onUnmounted(() => {
    disconnect()
  })

  return { isConnected, disconnect }
}
