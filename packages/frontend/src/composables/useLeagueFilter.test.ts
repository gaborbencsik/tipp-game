/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { computed } from 'vue'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    matches: { list: vi.fn() },
  },
}))

import { useMatchesStore } from '../stores/matches.store'
import { useLeagueFilter, MATCHES_LEAGUE_FILTER_LS_KEY } from './useLeagueFilter'

describe('useLeagueFilter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('initFromStorage', () => {
    it('sets leagueFilter from localStorage when value is in user leagues', () => {
      localStorage.setItem(MATCHES_LEAGUE_FILTER_LS_KEY, 'l2')
      const matchesStore = useMatchesStore()
      const userLeagueIds = computed(() => ['l1', 'l2', 'l3'])

      const { initFromStorage } = useLeagueFilter(userLeagueIds)
      initFromStorage()

      expect(matchesStore.leagueFilter).toBe('l2')
    })

    it('clears localStorage and leaves null when stored value is no longer in user leagues', () => {
      localStorage.setItem(MATCHES_LEAGUE_FILTER_LS_KEY, 'gone')
      const matchesStore = useMatchesStore()
      const userLeagueIds = computed(() => ['l1', 'l2'])

      const { initFromStorage } = useLeagueFilter(userLeagueIds)
      initFromStorage()

      expect(matchesStore.leagueFilter).toBeNull()
      expect(localStorage.getItem(MATCHES_LEAGUE_FILTER_LS_KEY)).toBeNull()
    })

    it('auto-selects the only league when user has exactly one and no LS value', () => {
      const matchesStore = useMatchesStore()
      const userLeagueIds = computed(() => ['solo'])

      const { initFromStorage } = useLeagueFilter(userLeagueIds)
      initFromStorage()

      expect(matchesStore.leagueFilter).toBe('solo')
    })

    it('leaves leagueFilter null when user has multiple leagues and no LS value', () => {
      const matchesStore = useMatchesStore()
      const userLeagueIds = computed(() => ['l1', 'l2'])

      const { initFromStorage } = useLeagueFilter(userLeagueIds)
      initFromStorage()

      expect(matchesStore.leagueFilter).toBeNull()
    })

    it('does not overwrite an existing in-memory leagueFilter', () => {
      localStorage.setItem(MATCHES_LEAGUE_FILTER_LS_KEY, 'l1')
      const matchesStore = useMatchesStore()
      matchesStore.leagueFilter = 'l2'
      const userLeagueIds = computed(() => ['l1', 'l2'])

      const { initFromStorage } = useLeagueFilter(userLeagueIds)
      initFromStorage()

      expect(matchesStore.leagueFilter).toBe('l2')
    })
  })

  describe('write-back', () => {
    it('writes the new league id to localStorage when leagueFilter changes', async () => {
      const matchesStore = useMatchesStore()
      const userLeagueIds = computed(() => ['l1', 'l2'])

      useLeagueFilter(userLeagueIds)
      matchesStore.leagueFilter = 'l1'
      await Promise.resolve()

      expect(localStorage.getItem(MATCHES_LEAGUE_FILTER_LS_KEY)).toBe('l1')
    })

    it('removes the localStorage key when leagueFilter is cleared', async () => {
      localStorage.setItem(MATCHES_LEAGUE_FILTER_LS_KEY, 'l1')
      const matchesStore = useMatchesStore()
      matchesStore.leagueFilter = 'l1'
      const userLeagueIds = computed(() => ['l1', 'l2'])

      useLeagueFilter(userLeagueIds)
      matchesStore.leagueFilter = null
      await Promise.resolve()

      expect(localStorage.getItem(MATCHES_LEAGUE_FILTER_LS_KEY)).toBeNull()
    })
  })
})
