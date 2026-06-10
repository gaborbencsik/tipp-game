import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockGetSession, mockFavoritesSummary } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockFavoritesSummary: vi.fn(),
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
    leagues: { favoritesSummary: mockFavoritesSummary },
  },
}))

import { useGroupFavoritesStore, type MatchLike } from '@/stores/group-favorites.store'

const MATCH_ARG_FRA: MatchLike = {
  homeTeam: { id: 'team-arg' },
  awayTeam: { id: 'team-fra' },
  league: { id: 'league-wc' },
}

const MATCH_GER_BRA: MatchLike = {
  homeTeam: { id: 'team-ger' },
  awayTeam: { id: 'team-bra' },
  league: { id: 'league-wc' },
}

describe('group-favorites.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockFavoritesSummary.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  it('ensureLoaded fetches once per league and indexes by team', async () => {
    mockFavoritesSummary.mockResolvedValue({
      members: [
        { userId: 'me', displayName: 'Me', teamId: 'team-arg' },
        { userId: 'alice', displayName: 'Alice', teamId: 'team-arg' },
        { userId: 'bob', displayName: 'Bob', teamId: 'team-fra' },
      ],
    })

    const store = useGroupFavoritesStore()
    await store.ensureLoaded('league-wc')
    await store.ensureLoaded('league-wc') // second call: cached

    expect(mockFavoritesSummary).toHaveBeenCalledTimes(1)
  })

  it('membersForMatch separates self from others (de-duplicated by userId)', async () => {
    mockFavoritesSummary.mockResolvedValue({
      members: [
        { userId: 'me', displayName: 'Me', teamId: 'team-arg' },
        { userId: 'alice', displayName: 'Alice', teamId: 'team-arg' },
        { userId: 'bob', displayName: 'Bob', teamId: 'team-fra' },
      ],
    })
    const store = useGroupFavoritesStore()
    await store.ensureLoaded('league-wc')

    const { self, others } = store.membersForMatch(MATCH_ARG_FRA, 'me')
    expect(self?.userId).toBe('me')
    expect(others.map((o) => o.userId).sort()).toEqual(['alice', 'bob'])
  })

  it('membersForMatch returns empty when nobody favors either team', async () => {
    mockFavoritesSummary.mockResolvedValue({
      members: [{ userId: 'alice', displayName: 'Alice', teamId: 'team-arg' }],
    })
    const store = useGroupFavoritesStore()
    await store.ensureLoaded('league-wc')

    const { self, others } = store.membersForMatch(MATCH_GER_BRA, 'me')
    expect(self).toBeNull()
    expect(others).toEqual([])
  })

  it('membersForMatch returns empty when match.league is null', async () => {
    const store = useGroupFavoritesStore()
    const match: MatchLike = { homeTeam: { id: 't1' }, awayTeam: { id: 't2' }, league: null }
    expect(store.membersForMatch(match, 'me')).toEqual({ self: null, others: [] })
  })

  it('hasOwnFavorite is true when current user favors a participating team', async () => {
    mockFavoritesSummary.mockResolvedValue({
      members: [
        { userId: 'me', displayName: 'Me', teamId: 'team-arg' },
        { userId: 'alice', displayName: 'Alice', teamId: 'team-fra' },
      ],
    })
    const store = useGroupFavoritesStore()
    await store.ensureLoaded('league-wc')
    expect(store.hasOwnFavorite(MATCH_ARG_FRA, 'me')).toBe(true)
    expect(store.hasOwnFavorite(MATCH_GER_BRA, 'me')).toBe(false)
  })

  it('hasOwnFavorite is false when currentUserId is null', async () => {
    mockFavoritesSummary.mockResolvedValue({
      members: [{ userId: 'me', displayName: 'Me', teamId: 'team-arg' }],
    })
    const store = useGroupFavoritesStore()
    await store.ensureLoaded('league-wc')
    expect(store.hasOwnFavorite(MATCH_ARG_FRA, null)).toBe(false)
  })
})
