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
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockLeaguesList: vi.fn(),
  mockLeaguesArchive: vi.fn(),
  mockLeaguesRestore: vi.fn(),
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
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        archive: mockLeaguesArchive,
        restore: mockLeaguesRestore,
      },
    },
  },
}))

import { useAdminLeaguesStore } from '@/stores/admin-leagues.store'

const ACTIVE: League = {
  id: 'league-1',
  name: 'World Cup 2026',
  shortName: 'WC2026',
  archivedAt: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}

const ARCHIVED: League = { ...ACTIVE, id: 'league-2', name: 'Euro 2024', archivedAt: '2026-07-21T10:00:00.000Z' }

describe('admin-leagues.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockLeaguesList.mockReset()
    mockLeaguesArchive.mockReset()
    mockLeaguesRestore.mockReset()
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
})
