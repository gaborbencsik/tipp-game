import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockExplainer } = vi.hoisted(() => ({ mockExplainer: vi.fn() }))

vi.mock('../api/index.js', () => ({
  api: { scoring: { explainer: mockExplainer } },
}))

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
    },
  },
}))

vi.mock('./toast.store.js', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}))

vi.mock('./auth.store.js', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import { useScoringExplainerStore } from './scoring-explainer.store'

describe('useScoringExplainerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('open() lazy fetch + isOpen=true on successful response', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    expect(store.isOpen).toBe(true)
    expect(store.data).not.toBeNull()
    expect(store.lastSource).toBe('menu')
    expect(mockExplainer).toHaveBeenCalledTimes(1)
  })

  it('second open() does not fetch (cache)', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    store.close()
    await store.open('leaderboard')
    expect(mockExplainer).toHaveBeenCalledTimes(1)
    expect(store.lastSource).toBe('leaderboard')
  })

  it('fetch error → isOpen stays false, error set, toast called', async () => {
    mockExplainer.mockRejectedValue(new Error('boom'))
    const store = useScoringExplainerStore()
    await store.open('menu')
    expect(store.isOpen).toBe(false)
    expect(store.error).toBe('boom')
    expect(store.data).toBeNull()
  })

  it('close() → isOpen=false', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    store.close()
    expect(store.isOpen).toBe(false)
  })

  it('open() tracks the scoring_explainer_opened event', async () => {
    mockExplainer.mockResolvedValue({
      default: {}, defaultFrozenAt: null,
      groups: [{ id: 'g1', name: 'X', config: {}, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] }],
    })
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const store = useScoringExplainerStore()
    await store.open('menu')
    expect(debugSpy).toHaveBeenCalledWith('[telemetry]', 'scoring_explainer_opened', expect.objectContaining({ source: 'menu', groupCount: '1' }))
  })

  it('close() tracks the scoring_explainer_closed event with durationMs', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const store = useScoringExplainerStore()
    await store.open('menu')
    store.close()
    expect(debugSpy).toHaveBeenCalledWith('[telemetry]', 'scoring_explainer_closed', expect.objectContaining({ durationMs: expect.any(Number) }))
  })
})
