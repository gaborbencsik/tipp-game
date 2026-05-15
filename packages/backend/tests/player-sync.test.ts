import { describe, it, expect, vi, beforeEach } from 'vitest'
import { filterValidStats } from '../src/services/player-sync.service.js'
import type { ApiFootballPlayerStat } from '../src/types/index.js'

function makeStat(overrides: { leagueId?: number | null; leagueName?: string | null } = {}): ApiFootballPlayerStat {
  return {
    team: { id: 1 },
    league: {
      id: 'leagueId' in overrides ? overrides.leagueId ?? null : 39,
      name: 'leagueName' in overrides ? overrides.leagueName ?? null : 'Premier League',
      season: 2025,
    },
    games: { appearences: 10, position: 'Midfielder', number: 7 },
    goals: { total: 3, assists: 2, conceded: 0 },
    passes: { total: 500, key: 20, accuracy: 85 },
    duels: { total: 100, won: 60 },
    cards: { yellow: 2, red: 0 },
  }
}

describe('filterValidStats', () => {
  it('keeps stats with league name present', () => {
    const stats = [makeStat({ leagueName: 'UEFA World Cup Qualifiers', leagueId: null })]
    expect(filterValidStats(stats)).toHaveLength(1)
  })

  it('removes stats where league name is null', () => {
    const stats = [makeStat({ leagueName: null, leagueId: 5 })]
    expect(filterValidStats(stats)).toHaveLength(0)
  })

  it('removes stats where league name is empty string', () => {
    const stats = [makeStat({ leagueName: '', leagueId: 39 })]
    expect(filterValidStats(stats)).toHaveLength(0)
  })

  it('filters mixed array correctly', () => {
    const stats = [
      makeStat({ leagueName: 'Premier League', leagueId: 39 }),
      makeStat({ leagueName: null, leagueId: null }),
      makeStat({ leagueName: 'EAFF E-1', leagueId: null }),
    ]
    const result = filterValidStats(stats)
    expect(result).toHaveLength(2)
    expect(result[0].league.name).toBe('Premier League')
    expect(result[1].league.name).toBe('EAFF E-1')
  })
})

describe('player-sync – football-api.service URL building', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds correct URL for fetchSquad', async () => {
    const { createFootballApiClient } = await import('../src/services/football-api.service.js')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: 0, paging: { current: 1, total: 1 }, response: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createFootballApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://v3.football.api-sports.io',
      timeoutMs: 5000,
    })

    await client.fetchSquad({ team: 42 })

    const calledUrl = mockFetch.mock.calls[0][0] as URL
    expect(calledUrl.pathname).toBe('/players/squads')
    expect(calledUrl.searchParams.get('team')).toBe('42')

    vi.unstubAllGlobals()
  })

  it('builds correct URL for fetchPlayers with pagination', async () => {
    const { createFootballApiClient } = await import('../src/services/football-api.service.js')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: 0, paging: { current: 2, total: 3 }, response: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createFootballApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://v3.football.api-sports.io',
      timeoutMs: 5000,
    })

    await client.fetchPlayers({ team: 1, season: 2026, page: 2 })

    const calledUrl = mockFetch.mock.calls[0][0] as URL
    expect(calledUrl.pathname).toBe('/players')
    expect(calledUrl.searchParams.get('team')).toBe('1')
    expect(calledUrl.searchParams.get('season')).toBe('2026')
    expect(calledUrl.searchParams.get('page')).toBe('2')

    vi.unstubAllGlobals()
  })

  it('does not include page param when not specified', async () => {
    const { createFootballApiClient } = await import('../src/services/football-api.service.js')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: 0, paging: { current: 1, total: 1 }, response: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createFootballApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://v3.football.api-sports.io',
      timeoutMs: 5000,
    })

    await client.fetchPlayers({ team: 5, season: 2025 })

    const calledUrl = mockFetch.mock.calls[0][0] as URL
    expect(calledUrl.searchParams.has('page')).toBe(false)

    vi.unstubAllGlobals()
  })

  it('includes x-apisports-key header', async () => {
    const { createFootballApiClient } = await import('../src/services/football-api.service.js')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: 0, paging: { current: 1, total: 1 }, response: [] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const client = createFootballApiClient({
      apiKey: 'my-secret-key',
      baseUrl: 'https://v3.football.api-sports.io',
      timeoutMs: 5000,
    })

    await client.fetchSquad({ team: 1 })

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit
    expect((calledOptions.headers as Record<string, string>)['x-apisports-key']).toBe('my-secret-key')

    vi.unstubAllGlobals()
  })
})
