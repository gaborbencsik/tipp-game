import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ScoringConfigFull, ScoringConfigWithImpact } from '@/types/index'

const {
  mockGetSession,
  mockScoringConfigGet,
  mockScoringConfigUpdate,
  mockScoringConfigOverride,
  mockRecalculateAll,
  mockRecalculateStatus,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockScoringConfigGet: vi.fn(),
  mockScoringConfigUpdate: vi.fn(),
  mockScoringConfigOverride: vi.fn(),
  mockRecalculateAll: vi.fn(),
  mockRecalculateStatus: vi.fn(),
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
        override: mockScoringConfigOverride,
      },
      scoring: {
        recalculateAll: mockRecalculateAll,
        recalculateStatus: mockRecalculateStatus,
      },
    },
  },
}))

import { useAdminScoringStore } from '@/stores/admin-scoring.store'

const CONFIG: ScoringConfigFull = {
  id: 'config-uuid-1',
  name: 'Default',
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
  frozenAt: null,
}

const CONFIG_WITH_IMPACT: ScoringConfigWithImpact = {
  ...CONFIG,
  affectedMatches: 0,
  affectedPredictions: 0,
}

const INPUT = {
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}

describe('admin-scoring.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockScoringConfigGet.mockReset()
    mockScoringConfigUpdate.mockReset()
    mockScoringConfigOverride.mockReset()
    mockRecalculateAll.mockReset()
    mockRecalculateStatus.mockReset()
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
    mockScoringConfigGet.mockResolvedValue(CONFIG_WITH_IMPACT)
    const store = useAdminScoringStore()
    await store.fetchConfig()
    expect(store.config).toEqual(CONFIG_WITH_IMPACT)
  })

  it('fetchConfig() → isLoading false after completion', async () => {
    mockScoringConfigGet.mockResolvedValue(CONFIG_WITH_IMPACT)
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
    const updated = { ...CONFIG, exactBonusPoints: 5 }
    mockScoringConfigUpdate.mockResolvedValue(updated)
    const store = useAdminScoringStore()
    await store.updateConfig({ ...INPUT, exactBonusPoints: 5 })
    expect(store.config?.exactBonusPoints).toBe(5)
    expect(store.saveStatus).toBe('saved')
  })

  it('updateConfig() error → error set, saveStatus error', async () => {
    mockScoringConfigUpdate.mockRejectedValue(new Error('Not authorized'))
    const store = useAdminScoringStore()
    await store.updateConfig(INPUT)
    expect(store.error).toBe('Not authorized')
    expect(store.saveStatus).toBe('error')
  })

  it('updateConfig() with frozen error → conflictError set, refetches config', async () => {
    mockScoringConfigUpdate.mockRejectedValue(new Error('Scoring config is frozen'))
    mockScoringConfigGet.mockResolvedValue({ ...CONFIG_WITH_IMPACT, frozenAt: '2026-06-15T10:00:00Z' })
    const store = useAdminScoringStore()
    await store.updateConfig(INPUT)
    expect(store.conflictError).toContain('frozen')
    expect(store.isFrozen).toBe(true)
  })

  // ─── overrideConfig ───────────────────────────────────────────────────────

  it('overrideConfig() → config updated, saveStatus saved', async () => {
    const updated = { ...CONFIG, exactBonusPoints: 7, frozenAt: null }
    mockScoringConfigOverride.mockResolvedValue(updated)
    const store = useAdminScoringStore()
    await store.overrideConfig({ values: INPUT, reason: 'fix', recalculate: false })
    expect(store.config?.exactBonusPoints).toBe(7)
    expect(store.saveStatus).toBe('saved')
  })

  // ─── triggerRecalculate ───────────────────────────────────────────────────

  it('triggerRecalculate() success → recalcRunState becomes running', async () => {
    mockRecalculateAll.mockResolvedValue({ status: 'started' })
    mockRecalculateStatus.mockResolvedValue({ status: 'running', lastResult: null })
    mockScoringConfigGet.mockResolvedValue(CONFIG_WITH_IMPACT)
    const store = useAdminScoringStore()
    await store.triggerRecalculate()
    expect(store.recalcRunState).toBe('running')
  })

  it('triggerRecalculate() conflict → conflictError set', async () => {
    mockRecalculateAll.mockRejectedValue(new Error('Sync or recalculation already in progress'))
    const store = useAdminScoringStore()
    await store.triggerRecalculate()
    expect(store.conflictError).toContain('progress')
    expect(store.recalcRunState).toBe('error')
  })
})
