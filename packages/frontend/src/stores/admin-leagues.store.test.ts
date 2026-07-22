import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { League } from '@/types/index'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const {
  mockGetSession,
  mockLeaguesList,
  mockLeaguesArchive,
  mockLeaguesRestore,
  mockLeaguesCreate,
  mockLeaguesUpdate,
  mockLeaguesSync,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockLeaguesList: vi.fn(),
  mockLeaguesArchive: vi.fn(),
  mockLeaguesRestore: vi.fn(),
  mockLeaguesCreate: vi.fn(),
  mockLeaguesUpdate: vi.fn(),
  mockLeaguesSync: vi.fn(),
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
      leagues: {
        list: mockLeaguesList,
        create: mockLeaguesCreate,
        update: mockLeaguesUpdate,
        delete: vi.fn(),
        archive: mockLeaguesArchive,
        restore: mockLeaguesRestore,
        sync: mockLeaguesSync,
      },
    },
  },
}))

import { useAdminLeaguesStore } from '@/stores/admin-leagues.store'

const ACTIVE: League = {
  id: 'league-1',
  name: 'World Cup 2026',
  shortName: 'WC2026',
  status: 'active',
  type: 'league',
  archivedAt: null,
  startsAt: null,
  syncEnabled: false,
  externalId: null,
  season: null,
  syncFrom: null,
  syncTo: null,
  fixtureAllowlist: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}

const ARCHIVED: League = {
  ...ACTIVE,
  id: 'league-2',
  name: 'Euro 2024',
  status: 'archived',
  archivedAt: '2026-07-21T10:00:00.000Z',
}

describe('admin-leagues.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockLeaguesList.mockReset()
    mockLeaguesArchive.mockReset()
    mockLeaguesRestore.mockReset()
    mockLeaguesCreate.mockReset()
    mockLeaguesUpdate.mockReset()
    mockLeaguesSync.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  it('initial leagues empty, not loading, no error', () => {
    const store = useAdminLeaguesStore()
    expect(store.leagues).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchLeagues() loads with includeArchived=true so admin sees archived too', async () => {
    mockLeaguesList.mockResolvedValue([ACTIVE, ARCHIVED])
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    expect(mockLeaguesList).toHaveBeenCalledWith('mock-token', true)
    expect(store.leagues).toEqual([ACTIVE, ARCHIVED])
  })

  it('fetchLeagues() error → error set', async () => {
    mockLeaguesList.mockRejectedValue(new Error('Network error'))
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    expect(store.error).toBe('Network error')
    expect(store.leagues).toEqual([])
  })

  it('archiveLeague() → league replaced with archived version in list', async () => {
    mockLeaguesList.mockResolvedValue([ACTIVE])
    mockLeaguesArchive.mockResolvedValue({ ...ACTIVE, archivedAt: '2026-07-21T11:00:00.000Z' })
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.archiveLeague('league-1')
    expect(mockLeaguesArchive).toHaveBeenCalledWith('mock-token', 'league-1')
    expect(store.leagues.find(l => l.id === 'league-1')?.archivedAt).toBe('2026-07-21T11:00:00.000Z')
  })

  it('restoreLeague() → league replaced with active version in list', async () => {
    mockLeaguesList.mockResolvedValue([ARCHIVED])
    mockLeaguesRestore.mockResolvedValue({ ...ARCHIVED, archivedAt: null })
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.restoreLeague('league-2')
    expect(mockLeaguesRestore).toHaveBeenCalledWith('mock-token', 'league-2')
    expect(store.leagues.find(l => l.id === 'league-2')?.archivedAt).toBeNull()
  })

  it('archiveLeague() error → error set', async () => {
    mockLeaguesList.mockResolvedValue([ACTIVE])
    mockLeaguesArchive.mockRejectedValue(new Error('League not found'))
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.archiveLeague('league-1')
    expect(store.error).toBe('League not found')
  })

  it('createLeague() → new league appended to list', async () => {
    mockLeaguesList.mockResolvedValue([])
    const created: League = { ...ACTIVE, id: 'league-3', name: 'Premier League', shortName: 'PL' }
    mockLeaguesCreate.mockResolvedValue(created)
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.createLeague({ name: 'Premier League', shortName: 'PL', status: 'active', syncEnabled: false })
    expect(mockLeaguesCreate).toHaveBeenCalledWith('mock-token', {
      name: 'Premier League', shortName: 'PL', status: 'active', syncEnabled: false,
    })
    expect(store.leagues.find(l => l.id === 'league-3')).toEqual(created)
  })

  it('createLeague() error → error set, list unchanged', async () => {
    mockLeaguesList.mockResolvedValue([ACTIVE])
    mockLeaguesCreate.mockRejectedValue(new Error('externalId already exists'))
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.createLeague({ name: 'X', shortName: 'X' })
    expect(store.error).toBe('externalId already exists')
    expect(store.leagues).toEqual([ACTIVE])
  })

  it('updateLeague() → league replaced with server response in list', async () => {
    mockLeaguesList.mockResolvedValue([ACTIVE])
    const updated: League = { ...ACTIVE, name: 'World Cup 2030', season: 2030 }
    mockLeaguesUpdate.mockResolvedValue(updated)
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.updateLeague('league-1', { name: 'World Cup 2030', season: 2030 })
    expect(mockLeaguesUpdate).toHaveBeenCalledWith('mock-token', 'league-1', { name: 'World Cup 2030', season: 2030 })
    expect(store.leagues.find(l => l.id === 'league-1')).toEqual(updated)
  })

  it('updateLeague() error → error set', async () => {
    mockLeaguesList.mockResolvedValue([ACTIVE])
    mockLeaguesUpdate.mockRejectedValue(new Error('season out of range'))
    const store = useAdminLeaguesStore()
    await store.fetchLeagues()
    await store.updateLeague('league-1', { season: 9999 })
    expect(store.error).toBe('season out of range')
  })

  it('syncLeague() → calls api.sync and returns the summary', async () => {
    const summary = { matchesUpserted: 10, teamsUpserted: 5, playersUpserted: 9, errors: [] }
    mockLeaguesSync.mockResolvedValue(summary)
    const store = useAdminLeaguesStore()
    const result = await store.syncLeague('league-1')
    expect(mockLeaguesSync).toHaveBeenCalledWith('mock-token', 'league-1')
    expect(result).toEqual(summary)
    expect(store.error).toBeNull()
  })

  it('syncLeague() error → error set, returns null', async () => {
    mockLeaguesSync.mockRejectedValue(new Error('Archived league cannot be synced'))
    const store = useAdminLeaguesStore()
    const result = await store.syncLeague('league-2')
    expect(store.error).toBe('Archived league cannot be synced')
    expect(result).toBeNull()
  })
})
