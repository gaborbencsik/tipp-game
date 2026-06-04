import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSubscribeApi, mockUnsubscribeApi } = vi.hoisted(() => ({
  mockSubscribeApi: vi.fn(),
  mockUnsubscribeApi: vi.fn(),
}))

vi.mock('../api/index.js', () => ({
  api: {
    push: {
      subscribe: mockSubscribeApi,
      unsubscribe: mockUnsubscribeApi,
    },
  },
}))

vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BNz_dummy_public_key_padded____________________________________________________________')

import { isPushSupported, getPermissionState, ensureSubscribed, unsubscribeFromPush, getCurrentSubscription } from './push.js'

interface MockSub {
  endpoint: string
  getKey: (name: 'auth' | 'p256dh') => ArrayBuffer | null
  unsubscribe: () => Promise<boolean>
}

function makeSub(endpoint = 'https://push.example.com/abc'): MockSub {
  const buf = new Uint8Array([1, 2, 3, 4]).buffer
  return {
    endpoint,
    getKey: () => buf,
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
}

describe('isPushSupported', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('false when serviceWorker is missing', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', {})
    expect(isPushSupported()).toBe(false)
  })

  it('true when SW + PushManager + Notification all present', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} })
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} })
    expect(isPushSupported()).toBe(true)
  })
})

describe('getPermissionState', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns "unsupported" when not supported', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', {})
    expect(getPermissionState()).toBe('unsupported')
  })

  it('returns Notification.permission when supported', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} })
    vi.stubGlobal('window', { PushManager: class {}, Notification: { permission: 'granted' } })
    vi.stubGlobal('Notification', { permission: 'granted' })
    expect(getPermissionState()).toBe('granted')
  })
})

describe('ensureSubscribed', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>
  let mockGetSubscription: ReturnType<typeof vi.fn>
  let mockRequestPermission: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.unstubAllGlobals()
    mockSubscribeApi.mockReset()
    mockSubscribe = vi.fn()
    mockGetSubscription = vi.fn()
    mockRequestPermission = vi.fn()

    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: mockGetSubscription,
            subscribe: mockSubscribe,
          },
        }),
      },
      userAgent: 'Mozilla/5.0 Test',
    })
    vi.stubGlobal('window', { PushManager: class {}, Notification: { permission: 'default', requestPermission: mockRequestPermission } })
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: mockRequestPermission })
    vi.stubGlobal('btoa', (s: string) => Buffer.from(s, 'binary').toString('base64'))
    vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('binary'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when permission is denied', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: mockRequestPermission })
    const result = await ensureSubscribed('token')
    expect(result).toBeNull()
    expect(mockSubscribeApi).not.toHaveBeenCalled()
  })

  it('requests permission when "default" and aborts on deny', async () => {
    mockRequestPermission.mockResolvedValue('denied')
    const result = await ensureSubscribed('token')
    expect(mockRequestPermission).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('reuses existing subscription and POSTs to backend', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: mockRequestPermission })
    const sub = makeSub()
    mockGetSubscription.mockResolvedValue(sub)
    const result = await ensureSubscribed('token-1')
    expect(result).toBe(sub)
    expect(mockSubscribe).not.toHaveBeenCalled()
    expect(mockSubscribeApi).toHaveBeenCalledWith('token-1', expect.objectContaining({
      endpoint: 'https://push.example.com/abc',
      userAgent: 'Mozilla/5.0 Test',
    }))
  })

  it('creates a new subscription when none exists', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: mockRequestPermission })
    mockGetSubscription.mockResolvedValue(null)
    const sub = makeSub('https://push.example.com/new')
    mockSubscribe.mockResolvedValue(sub)
    const result = await ensureSubscribed('token-2')
    expect(mockSubscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(result).toBe(sub)
    expect(mockSubscribeApi).toHaveBeenCalledWith('token-2', expect.objectContaining({ endpoint: 'https://push.example.com/new' }))
  })
})

describe('unsubscribeFromPush', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    mockUnsubscribeApi.mockReset()
  })

  it('no-op when no current subscription', async () => {
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
        }),
      },
    })
    await unsubscribeFromPush('token')
    expect(mockUnsubscribeApi).not.toHaveBeenCalled()
  })

  it('calls api.push.unsubscribe with endpoint and then sub.unsubscribe()', async () => {
    const sub = makeSub('https://push.example.com/x')
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) },
        }),
      },
    })
    await unsubscribeFromPush('token-3')
    expect(mockUnsubscribeApi).toHaveBeenCalledWith('token-3', 'https://push.example.com/x')
    expect(sub.unsubscribe).toHaveBeenCalled()
  })

  it('still calls sub.unsubscribe() even if backend call fails', async () => {
    const sub = makeSub('https://push.example.com/y')
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) },
        }),
      },
    })
    mockUnsubscribeApi.mockRejectedValueOnce(new Error('boom'))
    await expect(unsubscribeFromPush('token-4')).rejects.toThrow('boom')
    expect(sub.unsubscribe).toHaveBeenCalled()
  })
})

describe('getCurrentSubscription', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when serviceWorker not supported', async () => {
    vi.stubGlobal('navigator', {})
    const result = await getCurrentSubscription()
    expect(result).toBeNull()
  })

  it('returns the registration subscription', async () => {
    const sub = makeSub()
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) },
        }),
      },
    })
    const result = await getCurrentSubscription()
    expect(result).toBe(sub)
  })
})
