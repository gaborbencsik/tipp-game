import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Match, MatchDateGroup } from '@/types/index'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const { mockGetSession, mockMatchesList } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockMatchesList: vi.fn(),
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
    matches: { list: mockMatchesList },
  },
}))

import { useMatchesStore } from '@/stores/matches.store'

const MATCH_SCHEDULED: Match = {
  id: 'match-1',
  homeTeam: { id: 'ht1', name: 'Germany', shortCode: 'GER', flagUrl: null },
  awayTeam: { id: 'at1', name: 'France', shortCode: 'FRA', flagUrl: null },
  venue: { name: 'Arena', city: 'Munich' },
  stage: 'group',
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: '2026-06-11T15:00:00.000Z',
  status: 'scheduled',
  result: null,
}

const MATCH_LIVE: Match = {
  id: 'match-2',
  homeTeam: { id: 'ht2', name: 'Spain', shortCode: 'ESP', flagUrl: null },
  awayTeam: { id: 'at2', name: 'Italy', shortCode: 'ITA', flagUrl: null },
  venue: null,
  stage: 'group',
  groupName: 'B',
  matchNumber: 2,
  scheduledAt: '2026-06-11T18:00:00.000Z',
  status: 'live',
  result: null,
}

const MATCH_FINISHED: Match = {
  id: 'match-3',
  homeTeam: { id: 'ht3', name: 'Brazil', shortCode: 'BRA', flagUrl: null },
  awayTeam: { id: 'at3', name: 'Argentina', shortCode: 'ARG', flagUrl: null },
  venue: { name: 'Stadium', city: 'Sao Paulo' },
  stage: 'final',
  groupName: null,
  matchNumber: 64,
  scheduledAt: '2026-07-19T18:00:00.000Z',
  status: 'finished',
  result: { homeGoals: 3, awayGoals: 2 },
}

describe('matches.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMatchesList.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  // ─── Initial state ───────────────────────────────────────────────────────────

  it('initial matches array is empty', () => {
    const store = useMatchesStore()
    expect(store.matches).toEqual([])
  })

  it('initial isLoading is false', () => {
    const store = useMatchesStore()
    expect(store.isLoading).toBe(false)
  })

  it('initial error is null', () => {
    const store = useMatchesStore()
    expect(store.error).toBeNull()
  })

  // ─── fetchMatches ────────────────────────────────────────────────────────────

  it('fetchMatches() → matches populated', async () => {
    mockMatchesList.mockResolvedValue([MATCH_SCHEDULED, MATCH_LIVE])
    const store = useMatchesStore()
    await store.fetchMatches()
    expect(store.matches).toEqual([MATCH_SCHEDULED, MATCH_LIVE])
  })

  it('fetchMatches() → isLoading false after completion', async () => {
    mockMatchesList.mockResolvedValue([])
    const store = useMatchesStore()
    await store.fetchMatches()
    expect(store.isLoading).toBe(false)
  })

  it('fetchMatches() error → error set, matches remain empty', async () => {
    mockMatchesList.mockRejectedValue(new Error('Network error'))
    const store = useMatchesStore()
    await store.fetchMatches()
    expect(store.error).toBe('Network error')
    expect(store.matches).toEqual([])
  })

  it('fetchMatches() unknown error → generic error message', async () => {
    mockMatchesList.mockRejectedValue('unexpected')
    const store = useMatchesStore()
    await store.fetchMatches()
    expect(store.error).toBe('Ismeretlen hiba')
  })

  // ─── filteredMatches ─────────────────────────────────────────────────────────

  it('no filter → all matches returned', () => {
    const store = useMatchesStore()
    store.matches = [MATCH_SCHEDULED, MATCH_LIVE, MATCH_FINISHED]
    expect(store.filteredMatches).toHaveLength(3)
  })

  it('stageFilter=final → only final matches', () => {
    const store = useMatchesStore()
    store.matches = [MATCH_SCHEDULED, MATCH_LIVE, MATCH_FINISHED]
    store.stageFilter = 'final'
    expect(store.filteredMatches).toHaveLength(1)
    expect(store.filteredMatches[0]?.id).toBe('match-3')
  })

  it('statusFilter=live → only live matches', () => {
    const store = useMatchesStore()
    store.matches = [MATCH_SCHEDULED, MATCH_LIVE, MATCH_FINISHED]
    store.statusFilter = 'live'
    expect(store.filteredMatches).toHaveLength(1)
    expect(store.filteredMatches[0]?.id).toBe('match-2')
  })

  it('stageFilter=group → group stage matches only', () => {
    const store = useMatchesStore()
    store.matches = [MATCH_SCHEDULED, MATCH_LIVE, MATCH_FINISHED]
    store.stageFilter = 'group'
    expect(store.filteredMatches).toHaveLength(2)
  })

  // ─── matchesByDate ────────────────────────────────────────────────────────────

  it('matchesByDate → matches grouped by day', () => {
    const store = useMatchesStore()
    store.matches = [MATCH_SCHEDULED, MATCH_LIVE, MATCH_FINISHED]
    const byDate: MatchDateGroup[] = store.matchesByDate
    expect(byDate).toHaveLength(2)
    const firstGroup = byDate.find(g => g.date === '2026-06-11')
    expect(firstGroup).toBeDefined()
    expect(firstGroup?.matches).toHaveLength(2)
    const secondGroup = byDate.find(g => g.date === '2026-07-19')
    expect(secondGroup).toBeDefined()
    expect(secondGroup?.matches).toHaveLength(1)
  })

  it('matchesByDate group label is a non-empty string', () => {
    const store = useMatchesStore()
    store.matches = [MATCH_SCHEDULED]
    const byDate: MatchDateGroup[] = store.matchesByDate
    expect(byDate[0]?.label).toBeTruthy()
    expect(typeof byDate[0]?.label).toBe('string')
  })

  it('matchesByDate with empty store → empty array', () => {
    const store = useMatchesStore()
    expect(store.matchesByDate).toEqual([])
  })
})
