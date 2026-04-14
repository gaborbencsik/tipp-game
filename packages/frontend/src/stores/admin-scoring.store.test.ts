import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ScoringConfigFull } from '@/types/index'

const {
  mockGetSession,
  mockScoringConfigGet,
  mockScoringConfigUpdate,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockScoringConfigGet: vi.fn(),
  mockScoringConfigUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    admin: {
      scoringConfig: {
        get: mockScoringConfigGet,
        update: mockScoringConfigUpdate,
      },
    },
  },
}))

import { useAdminScoringStore } from '@/stores/admin-scoring.store'

const CONFIG: ScoringConfigFull = {
  id: 'config-uuid-1',
  name: 'Default',
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
}

const INPUT = {
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
}

describe('admin-scoring.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockScoringConfigGet.mockReset()
    mockScoringConfigUpdate.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  it('initial config is null', () => {
    const store = useAdminScoringStore()
    expect(store.config).toBeNull()
  })

  it('initial saveStatus is idle', () => {
    const store = useAdminScoringStore()
    expect(store.saveStatus).toBe('idle')
  })

  // ─── fetchConfig ──────────────────────────────────────────────────────────

  it('fetchConfig() → config state populated', async () => {
    mockScoringConfigGet.mockResolvedValue(CONFIG)
    const store = useAdminScoringStore()
    await store.fetchConfig()
    expect(store.config).toEqual(CONFIG)
  })

  it('fetchConfig() → isLoading false after completion', async () => {
    mockScoringConfigGet.mockResolvedValue(CONFIG)
    const store = useAdminScoringStore()
    await store.fetchConfig()
    expect(store.isLoading).toBe(false)
  })

  it('fetchConfig() error → error set', async () => {
    mockScoringConfigGet.mockRejectedValue(new Error('Not found'))
    const store = useAdminScoringStore()
    await store.fetchConfig()
    expect(store.error).toBe('Not found')
    expect(store.config).toBeNull()
  })

  // ─── updateConfig ─────────────────────────────────────────────────────────

  it('updateConfig() → config state updated, saveStatus saved', async () => {
    const updated = { ...CONFIG, exactScore: 5 }
    mockScoringConfigUpdate.mockResolvedValue(updated)
    const store = useAdminScoringStore()
    await store.updateConfig({ ...INPUT, exactScore: 5 })
    expect(store.config).toEqual(updated)
    expect(store.saveStatus).toBe('saved')
  })

  it('updateConfig() error → error set, saveStatus error', async () => {
    mockScoringConfigUpdate.mockRejectedValue(new Error('Not authorized'))
    const store = useAdminScoringStore()
    await store.updateConfig(INPUT)
    expect(store.error).toBe('Not authorized')
    expect(store.saveStatus).toBe('error')
  })
})
