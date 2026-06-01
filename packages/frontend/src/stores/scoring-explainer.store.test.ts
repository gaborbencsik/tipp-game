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

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import { useScoringExplainerStore } from './scoring-explainer.store'

describe('useScoringExplainerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('open() lazy fetch + isOpen=true sikeres válasznál', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    expect(store.isOpen).toBe(true)
    expect(store.data).not.toBeNull()
    expect(store.lastSource).toBe('menu')
    expect(mockExplainer).toHaveBeenCalledTimes(1)
  })

  it('második open() nem fetch-el (cache)', async () => {
    mockExplainer.mockResolvedValue({ default: {}, defaultFrozenAt: null, groups: [] })
    const store = useScoringExplainerStore()
    await store.open('menu')
    store.close()
    await store.open('leaderboard')
    expect(mockExplainer).toHaveBeenCalledTimes(1)
    expect(store.lastSource).toBe('leaderboard')
  })

  it('fetch hiba → isOpen marad false, error set, toast hívva', async () => {
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
})
