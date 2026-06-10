import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

interface MockEventSourceInstance {
  url: string
  readyState: number
  onopen: ((ev: Event) => void) | null
  onerror: ((ev: Event) => void) | null
  listeners: Map<string, Array<(ev: MessageEvent) => void>>
  close: () => void
  triggerOpen: () => void
  triggerEvent: (event: string, data: string) => void
  triggerError: () => void
}

function makeMockEventSourceClass(
  instances: MockEventSourceInstance[],
): typeof EventSource {
  class MockEventSource implements MockEventSourceInstance {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSED = 2
    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSED = 2

    url: string
    readyState = 0
    onopen: ((ev: Event) => void) | null = null
    onerror: ((ev: Event) => void) | null = null
    onmessage: ((ev: MessageEvent) => void) | null = null
    withCredentials = false
    listeners = new Map<string, Array<(ev: MessageEvent) => void>>()

    constructor(url: string) {
      this.url = url
      instances.push(this)
    }

    addEventListener(event: string, handler: (ev: MessageEvent) => void): void {
      const arr = this.listeners.get(event) ?? []
      arr.push(handler)
      this.listeners.set(event, arr)
    }

    removeEventListener(event: string, handler: (ev: MessageEvent) => void): void {
      const arr = this.listeners.get(event) ?? []
      this.listeners.set(event, arr.filter(h => h !== handler))
    }

    dispatchEvent(): boolean { return true }

    close(): void {
      this.readyState = 2
    }

    triggerOpen(): void {
      this.readyState = 1
      this.onopen?.(new Event('open'))
    }

    triggerEvent(event: string, data: string): void {
      const handlers = this.listeners.get(event) ?? []
      for (const h of handlers) h(new MessageEvent(event, { data }))
    }

    triggerError(): void {
      this.readyState = 0
      this.onerror?.(new Event('error'))
    }
  }
  return MockEventSource as unknown as typeof EventSource
}

describe('useMatchEvents', () => {
  let instances: MockEventSourceInstance[]

  beforeEach(() => {
    instances = []
    vi.stubGlobal('EventSource', makeMockEventSourceClass(instances))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.resetModules()
  })

  it('does not connect when feature flag is disabled', async () => {
    vi.stubEnv('VITE_USE_SSE_EVENTS', 'false')
    const { useMatchEvents } = await import('./useMatchEvents.js')
    const token = ref<string | null>('jwt-abc')
    const { isConnected } = useMatchEvents(token, { onMatchUpdate: () => {} })
    expect(instances).toHaveLength(0)
    expect(isConnected.value).toBe(false)
  })

  it('opens an EventSource when flag is enabled and token is set', async () => {
    vi.stubEnv('VITE_USE_SSE_EVENTS', 'true')
    const { useMatchEvents } = await import('./useMatchEvents.js')
    const token = ref<string | null>('jwt-abc')
    const onMatchUpdate = vi.fn()

    useMatchEvents(token, { onMatchUpdate })
    await Promise.resolve()

    expect(instances).toHaveLength(1)
    expect(instances[0]!.url).toContain('/api/events')
    expect(instances[0]!.url).toContain('token=jwt-abc')
  })

  it('forwards match.update events to the callback', async () => {
    vi.stubEnv('VITE_USE_SSE_EVENTS', 'true')
    const { useMatchEvents } = await import('./useMatchEvents.js')
    const token = ref<string | null>('jwt-abc')
    const onMatchUpdate = vi.fn()

    useMatchEvents(token, { onMatchUpdate })
    await Promise.resolve()

    const inst = instances[0]!
    inst.triggerOpen()
    inst.triggerEvent('match.update', JSON.stringify({
      matchId: 'm1', status: 'live', homeScore: 1, awayScore: 0, updatedAt: 'now',
    }))

    expect(onMatchUpdate).toHaveBeenCalledTimes(1)
    expect(onMatchUpdate).toHaveBeenCalledWith({
      matchId: 'm1', status: 'live', homeScore: 1, awayScore: 0, updatedAt: 'now',
    })
  })

  it('reflects connection state in isConnected ref', async () => {
    vi.stubEnv('VITE_USE_SSE_EVENTS', 'true')
    const { useMatchEvents } = await import('./useMatchEvents.js')
    const token = ref<string | null>('jwt-abc')
    const { isConnected } = useMatchEvents(token, { onMatchUpdate: () => {} })
    await Promise.resolve()

    expect(isConnected.value).toBe(false)
    instances[0]!.triggerOpen()
    expect(isConnected.value).toBe(true)
    instances[0]!.triggerError()
    expect(isConnected.value).toBe(false)
  })

  it('disconnect() closes the underlying EventSource', async () => {
    vi.stubEnv('VITE_USE_SSE_EVENTS', 'true')
    const { useMatchEvents } = await import('./useMatchEvents.js')
    const token = ref<string | null>('jwt-abc')
    const closeSpy = vi.fn()
    const { disconnect } = useMatchEvents(token, { onMatchUpdate: () => {} })
    await Promise.resolve()
    instances[0]!.close = closeSpy

    disconnect()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})
