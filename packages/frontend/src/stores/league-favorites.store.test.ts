import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const {
  mockGetSession,
  mockGetLeagueFavorites,
  mockSetLeagueFavorite,
  mockLeaguesList,
  mockLeagueTeamsForLeague,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockGetLeagueFavorites: vi.fn(),
  mockSetLeagueFavorite: vi.fn(),
  mockLeaguesList: vi.fn(),
  mockLeagueTeamsForLeague: vi.fn(),
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
    health: vi.fn(),
    auth: { me: vi.fn() },
    users: {
      getLeagueFavorites: mockGetLeagueFavorites,
      setLeagueFavorite: mockSetLeagueFavorite,
    },
    leagues: { list: mockLeaguesList },
    leagueTeams: { forLeague: mockLeagueTeamsForLeague },
  },
}))

import { useLeagueFavoritesStore } from '@/stores/league-favorites.store'

describe('league-favorites.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockGetLeagueFavorites.mockReset()
    mockSetLeagueFavorite.mockReset()
    mockLeaguesList.mockReset()
    mockLeagueTeamsForLeague.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  it('fetchFavorites populates favorites', async () => {
    const favs = [
      { id: 'f1', userId: 'u1', leagueId: 'l1', teamId: 't1', setAt: '2026-01-01T00:00:00Z', isLocked: false },
    ]
    mockGetLeagueFavorites.mockResolvedValue(favs)
    const store = useLeagueFavoritesStore()
    await store.fetchFavorites()
    expect(store.favorites).toEqual(favs)
  })

  it('fetchFavorites error sets error', async () => {
    mockGetLeagueFavorites.mockRejectedValue(new Error('Network'))
    const store = useLeagueFavoritesStore()
    await store.fetchFavorites()
    expect(store.error).toBe('Network')
    expect(store.favorites).toEqual([])
  })

  it('fetchLeagues populates leagues', async () => {
    const leagues = [{ id: 'l1', name: 'Liga A', shortName: 'LA', createdAt: '', updatedAt: '' }]
    mockLeaguesList.mockResolvedValue(leagues)
    const store = useLeagueFavoritesStore()
    await store.fetchLeagues()
    expect(store.leagues).toEqual(leagues)
  })

  it('setFavorite adds new favorite', async () => {
    const fav = { id: 'f1', userId: 'u1', leagueId: 'l1', teamId: 't2', setAt: '2026-01-01T00:00:00Z', isLocked: false }
    mockSetLeagueFavorite.mockResolvedValue(fav)
    const store = useLeagueFavoritesStore()
    await store.setFavorite('l1', 't2')
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].teamId).toBe('t2')
  })

  it('setFavorite updates existing favorite', async () => {
    const existing = { id: 'f1', userId: 'u1', leagueId: 'l1', teamId: 't1', setAt: '2026-01-01T00:00:00Z', isLocked: false }
    const updated = { ...existing, teamId: 't2' }
    mockGetLeagueFavorites.mockResolvedValue([existing])
    mockSetLeagueFavorite.mockResolvedValue(updated)
    const store = useLeagueFavoritesStore()
    await store.fetchFavorites()
    await store.setFavorite('l1', 't2')
    expect(store.favorites).toHaveLength(1)
    expect(store.favorites[0].teamId).toBe('t2')
  })

  it('favoriteByLeagueId returns correct favorite', async () => {
    const favs = [
      { id: 'f1', userId: 'u1', leagueId: 'l1', teamId: 't1', setAt: '2026-01-01T00:00:00Z', isLocked: false },
      { id: 'f2', userId: 'u1', leagueId: 'l2', teamId: 't3', setAt: '2026-01-01T00:00:00Z', isLocked: true },
    ]
    mockGetLeagueFavorites.mockResolvedValue(favs)
    const store = useLeagueFavoritesStore()
    await store.fetchFavorites()
    expect(store.favoriteByLeagueId('l2')?.teamId).toBe('t3')
    expect(store.favoriteByLeagueId('l99')).toBeUndefined()
  })

  it('fetchLeagueTeams caches results', async () => {
    const teams = [{ id: 't1', name: 'Team A', shortCode: 'TA', flagUrl: null }]
    mockLeagueTeamsForLeague.mockResolvedValue(teams)
    const store = useLeagueFavoritesStore()
    await store.fetchLeagueTeams('l1')
    await store.fetchLeagueTeams('l1')
    expect(mockLeagueTeamsForLeague).toHaveBeenCalledTimes(1)
    expect(store.leagueTeamsMap['l1']).toEqual(teams)
  })
})
