import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useMatchEvents, type MatchEventsHandle, type MatchUpdateEvent } from './useMatchEvents.js'

vi.mock('../lib/supabase.js', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

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

function makeMockEventSourceClass(instances: MockEventSourceInstance[]): typeof EventSource {
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
    close(): void { this.readyState = 2 }
    triggerOpen(): void { this.readyState = 1; this.onopen?.(new Event('open')) }
    triggerEvent(event: string, data: string): void {
      const handlers = this.listeners.get(event) ?? []
      for (const h of handlers) h(new MessageEvent(event, { data }))
    }
    triggerError(): void { this.readyState = 0; this.onerror?.(new Event('error')) }
  }
  return MockEventSource as unknown as typeof EventSource
}

interface MountResult {
  instances: MockEventSourceInstance[]
  handle: MatchEventsHandle
  onMatchUpdate: ReturnType<typeof vi.fn>
  unmount: () => void
}

async function mountHost(opts: {
  enabled: boolean
  token: string | null
}): Promise<MountResult> {
  const instances: MockEventSourceInstance[] = []
  vi.stubGlobal('EventSource', makeMockEventSourceClass(instances))
  const onMatchUpdate = vi.fn()
  let handle: MatchEventsHandle | null = null

  const Host = defineComponent({
    setup() {
      handle = useMatchEvents({
        onMatchUpdate,
        enabled: opts.enabled,
        tokenResolver: async () => opts.token,
      })
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  await flushPromises()

  return { instances, handle: handle!, onMatchUpdate, unmount: () => wrapper.unmount() }
}

describe('useMatchEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not connect when disabled flag is false', async () => {
    const { instances, handle, unmount } = await mountHost({ enabled: false, token: 'jwt-abc' })
    expect(instances).toHaveLength(0)
    expect(handle.isConnected.value).toBe(false)
    unmount()
  })

  it('does not connect when token resolver returns null', async () => {
    const { instances, handle, unmount } = await mountHost({ enabled: true, token: null })
    expect(instances).toHaveLength(0)
    expect(handle.isConnected.value).toBe(false)
    unmount()
  })

  it('opens an EventSource with the JWT in the query string', async () => {
    const { instances, unmount } = await mountHost({ enabled: true, token: 'jwt-abc' })
    expect(instances).toHaveLength(1)
    expect(instances[0]!.url).toContain('/api/events')
    expect(instances[0]!.url).toContain('token=jwt-abc')
    unmount()
  })

  it('forwards match.update events to the callback', async () => {
    const { instances, onMatchUpdate, unmount } = await mountHost({ enabled: true, token: 'jwt-abc' })
    const inst = instances[0]!
    inst.triggerOpen()
    const payload: MatchUpdateEvent = {
      matchId: 'm1', status: 'live', homeScore: 1, awayScore: 0, updatedAt: 'now',
    }
    inst.triggerEvent('match.update', JSON.stringify(payload))

    expect(onMatchUpdate).toHaveBeenCalledTimes(1)
    expect(onMatchUpdate).toHaveBeenCalledWith(payload)
    unmount()
  })

  it('reflects connection state in isConnected ref', async () => {
    const { instances, handle, unmount } = await mountHost({ enabled: true, token: 'jwt-abc' })
    expect(handle.isConnected.value).toBe(false)
    instances[0]!.triggerOpen()
    expect(handle.isConnected.value).toBe(true)
    instances[0]!.triggerError()
    expect(handle.isConnected.value).toBe(false)
    unmount()
  })

  it('disconnect() closes the underlying EventSource', async () => {
    const { instances, handle, unmount } = await mountHost({ enabled: true, token: 'jwt-abc' })
    const closeSpy = vi.fn()
    instances[0]!.close = closeSpy
    handle.disconnect()
    expect(closeSpy).toHaveBeenCalledTimes(1)
    unmount()
  })
})
