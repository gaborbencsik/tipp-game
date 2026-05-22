import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../api/index.js', () => ({
  api: { matches: { revealInsight: vi.fn() } },
}))
import { api } from '../api/index.js'
import { useInsightsRevealStore } from './insights-reveal.store.js'

describe('useInsightsRevealStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('isRevealed returns false by default', () => {
    const store = useInsightsRevealStore()
    expect(store.isRevealed('m1')).toBe(false)
  })

  it('setRevealed marks a match as revealed', () => {
    const store = useInsightsRevealStore()
    store.setRevealed('m1', true)
    expect(store.isRevealed('m1')).toBe(true)
  })

  it('reveal() calls API and sets state on success', async () => {
    vi.mocked(api.matches.revealInsight).mockResolvedValueOnce({ revealed: true })
    const store = useInsightsRevealStore()
    await store.reveal('token-x', 'm1')
    expect(api.matches.revealInsight).toHaveBeenCalledWith('token-x', 'm1')
    expect(store.isRevealed('m1')).toBe(true)
  })

  it('reveal() leaves state false on API error and rethrows', async () => {
    vi.mocked(api.matches.revealInsight).mockRejectedValueOnce(new Error('boom'))
    const store = useInsightsRevealStore()
    await expect(store.reveal('token-x', 'm1')).rejects.toThrow('boom')
    expect(store.isRevealed('m1')).toBe(false)
  })
})
