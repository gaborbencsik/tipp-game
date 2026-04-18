import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminMatchesStore } from '@/stores/admin-matches.store'
import type { Match, MatchInput, MatchResultInput } from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

const {
  mockMatchesList,
  mockMatchesCreate,
  mockMatchesUpdate,
  mockMatchesDelete,
  mockMatchesSetResult,
} = vi.hoisted(() => ({
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockMatchesCreate: vi.fn().mockResolvedValue(undefined),
  mockMatchesUpdate: vi.fn().mockResolvedValue(undefined),
  mockMatchesDelete: vi.fn().mockResolvedValue(undefined),
  mockMatchesSetResult: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/api/index', () => ({
  api: {
    matches: { list: mockMatchesList },
    admin: {
      matches: {
        create: mockMatchesCreate,
        update: mockMatchesUpdate,
        delete: mockMatchesDelete,
        setResult: mockMatchesSetResult,
      },
      teams: {
        list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      },
    },
  },
}))

const MATCH: Match = {
  id: 'match-uuid-1',
  homeTeam: { id: 'ht', name: 'Germany', shortCode: 'GER', flagUrl: null, teamType: 'national' as const, countryCode: 'de' },
  awayTeam: { id: 'at', name: 'France', shortCode: 'FRA', flagUrl: null, teamType: 'national' as const, countryCode: 'fr' },
  venue: null,
  stage: 'group',
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: '2026-06-11T15:00:00Z',
  status: 'scheduled',
  result: null,
}

const MATCH_INPUT: MatchInput = {
  homeTeamId: 'ht',
  awayTeamId: 'at',
  stage: 'group',
  scheduledAt: '2026-06-11T15:00:00Z',
}

describe('admin-matches.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMatchesList.mockReset().mockResolvedValue([])
    mockMatchesCreate.mockReset()
    mockMatchesUpdate.mockReset()
    mockMatchesDelete.mockReset()
    mockMatchesSetResult.mockReset()
  })

  it('initial state: matches=[], isLoading=false, error=null', () => {
    const store = useAdminMatchesStore()
    expect(store.matches).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchMatches() → populates matches', async () => {
    mockMatchesList.mockResolvedValue([MATCH])
    const store = useAdminMatchesStore()
    await store.fetchMatches()
    expect(store.matches).toHaveLength(1)
    expect(store.matches[0]?.id).toBe('match-uuid-1')
  })

  it('fetchMatches() error → sets error', async () => {
    mockMatchesList.mockRejectedValue(new Error('Network error'))
    const store = useAdminMatchesStore()
    await store.fetchMatches()
    expect(store.error).toBe('Network error')
    expect(store.matches).toEqual([])
  })

  it('createMatch() → fetches updated list', async () => {
    mockMatchesCreate.mockResolvedValue(undefined)
    mockMatchesList.mockResolvedValue([MATCH])
    const store = useAdminMatchesStore()
    await store.createMatch(MATCH_INPUT)
    expect(mockMatchesList).toHaveBeenCalledOnce()
    expect(store.matches).toHaveLength(1)
  })

  it('updateMatch() → fetches updated list', async () => {
    const updated = { ...MATCH, status: 'live' as const }
    mockMatchesUpdate.mockResolvedValue(undefined)
    mockMatchesList.mockResolvedValue([updated])
    const store = useAdminMatchesStore()
    store.matches = [MATCH]
    await store.updateMatch('match-uuid-1', { status: 'live' })
    expect(store.matches[0]?.status).toBe('live')
  })

  it('deleteMatch() → removes match from list', async () => {
    mockMatchesDelete.mockResolvedValue(undefined)
    const store = useAdminMatchesStore()
    store.matches = [MATCH]
    await store.deleteMatch('match-uuid-1')
    expect(store.matches).toHaveLength(0)
  })

  it('setResult() → fetches updated list', async () => {
    const finished = { ...MATCH, status: 'finished' as const, result: { homeGoals: 2, awayGoals: 1 } }
    mockMatchesSetResult.mockResolvedValue(undefined)
    mockMatchesList.mockResolvedValue([finished])
    const store = useAdminMatchesStore()
    store.matches = [MATCH]
    const input: MatchResultInput = { homeGoals: 2, awayGoals: 1 }
    await store.setResult('match-uuid-1', input)
    expect(store.matches[0]?.status).toBe('finished')
    expect(store.matches[0]?.result).toEqual({ homeGoals: 2, awayGoals: 1 })
  })

  it('setResult() error → sets error', async () => {
    mockMatchesSetResult.mockRejectedValue(new Error('Server error'))
    const store = useAdminMatchesStore()
    store.matches = [MATCH]
    await store.setResult('match-uuid-1', { homeGoals: 1, awayGoals: 0 })
    expect(store.error).toBe('Server error')
  })
})
