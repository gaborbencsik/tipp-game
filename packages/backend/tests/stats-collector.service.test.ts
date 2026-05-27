import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ApiFootballFixture, ApiFootballResponse } from '../src/types/index.js'
import type { FootballApiClient } from '../src/services/football-api.service.js'
import { FootballApiError } from '../src/services/football-api.service.js'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockInsert } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
}))

import {
  collectTeamStats,
  collectMatchStats,
  saveMatchStats,
} from '../src/services/insights/stats-collector.service.js'
import { StatsCollectionError } from '../src/services/insights/stats.types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-21T00:00:00.000Z')
const TEAM_ID = 33

function fixture(overrides: {
  id?: number
  date: string
  status?: string
  homeId?: number
  awayId?: number
  homeName?: string
  awayName?: string
  goalsHome?: number | null
  goalsAway?: number | null
  round?: string
}): ApiFootballFixture {
  const goalsHome = 'goalsHome' in overrides ? overrides.goalsHome ?? null : 0
  const goalsAway = 'goalsAway' in overrides ? overrides.goalsAway ?? null : 0
  return {
    fixture: {
      id: overrides.id ?? Math.floor(Math.random() * 1_000_000),
      date: overrides.date,
      status: { short: overrides.status ?? 'FT', long: '', elapsed: 90 },
      venue: { id: null, name: null, city: null },
    },
    league: { id: 1, round: overrides.round ?? 'R1' },
    teams: {
      home: { id: overrides.homeId ?? TEAM_ID, name: overrides.homeName ?? 'Home', code: null, logo: '', national: true },
      away: { id: overrides.awayId ?? 99, name: overrides.awayName ?? 'Away', code: null, logo: '', national: true },
    },
    goals: { home: goalsHome, away: goalsAway },
    score: {
      fulltime: { home: goalsHome, away: goalsAway },
      penalty: { home: null, away: null },
    },
  }
}

function fakeClient(byCall: ApiFootballResponse<ApiFootballFixture>[]): FootballApiClient {
  let i = 0
  const fetchTeamFixtures = vi.fn().mockImplementation(() => {
    const r = byCall[i] ?? { results: 0, paging: { current: 1, total: 1 }, response: [] }
    i += 1
    return Promise.resolve(r)
  })
  return {
    fetchFixtures: vi.fn(),
    fetchTeams: vi.fn(),
    fetchSquad: vi.fn(),
    fetchPlayers: vi.fn(),
    fetchTeamFixtures,
    fetchTeamFixturesByDateRange: vi.fn(),
  }
}

function rejectingClient(err: unknown): FootballApiClient {
  return {
    fetchFixtures: vi.fn(),
    fetchTeams: vi.fn(),
    fetchSquad: vi.fn(),
    fetchPlayers: vi.fn(),
    fetchTeamFixtures: vi.fn().mockRejectedValue(err),
    fetchTeamFixturesByDateRange: vi.fn().mockRejectedValue(err),
  }
}

function wrap(...fixtures: ApiFootballFixture[]): ApiFootballResponse<ApiFootballFixture> {
  return { results: fixtures.length, paging: { current: 1, total: 1 }, response: fixtures }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('collectTeamStats', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockInsert.mockReset()
  })

  it('aggregates KPIs from mixed results', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', goalsHome: 3, goalsAway: 0 }),
        fixture({ id: 2, date: '2026-04-20', goalsHome: 1, goalsAway: 1 }),
        fixture({ id: 3, date: '2026-04-10', goalsHome: 0, goalsAway: 2 }),
        fixture({ id: 4, date: '2026-03-15', goalsHome: 2, goalsAway: 1 }),
      ),
      wrap(),
      wrap(),
    ])

    const stats = await collectTeamStats(client, TEAM_ID, NOW)

    expect(stats.totalMatches).toBe(4)
    expect(stats.wins).toBe(2)
    expect(stats.draws).toBe(1)
    expect(stats.losses).toBe(1)
    expect(stats.winRate).toBe(0.5)
    expect(stats.goalsScored).toBe(6)
    expect(stats.goalsConceded).toBe(4)
    expect(stats.cleanSheets).toBe(1)
    expect(stats.cleanSheetRate).toBe(0.25)
    expect(stats.goalsScoredPerMatch).toBe(1.5)
    expect(stats.goalsConcededPerMatch).toBe(1)
    expect(stats.formString).toBe('WLDW')
    expect(stats.recentMatches).toHaveLength(4)
    expect(stats.recentMatches[0]?.date).toBe('2026-05-01')
  })

  it('returns zeroed stats when no finished matches exist', async () => {
    const client = fakeClient([wrap(), wrap(), wrap()])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)

    expect(stats.totalMatches).toBe(0)
    expect(stats.wins).toBe(0)
    expect(stats.winRate).toBe(0)
    expect(stats.formString).toBe('')
    expect(stats.recentMatches).toEqual([])
  })

  it('skips fixtures with non-finished status', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', status: 'NS' }),
        fixture({ id: 2, date: '2026-04-20', status: 'PST' }),
        fixture({ id: 3, date: '2026-04-10', status: 'FT', goalsHome: 1, goalsAway: 0 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.totalMatches).toBe(1)
    expect(stats.wins).toBe(1)
  })

  it('counts FT, AET and PEN as finished', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', status: 'AET', goalsHome: 1, goalsAway: 0 }),
        fixture({ id: 2, date: '2026-04-20', status: 'PEN', goalsHome: 1, goalsAway: 1 }),
        fixture({ id: 3, date: '2026-04-10', status: 'FT', goalsHome: 0, goalsAway: 2 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.totalMatches).toBe(3)
  })

  it('skips fixtures with null goals', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', status: 'FT', goalsHome: null, goalsAway: 0 }),
        fixture({ id: 2, date: '2026-04-20', status: 'FT', goalsHome: 2, goalsAway: 0 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.totalMatches).toBe(1)
  })

  it('formString reflects last 5 matches with newest on the right', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', goalsHome: 2, goalsAway: 0 }),
        fixture({ id: 2, date: '2026-04-25', goalsHome: 0, goalsAway: 1 }),
        fixture({ id: 3, date: '2026-04-20', goalsHome: 1, goalsAway: 1 }),
        fixture({ id: 4, date: '2026-04-15', goalsHome: 3, goalsAway: 0 }),
        fixture({ id: 5, date: '2026-04-10', goalsHome: 2, goalsAway: 0 }),
        fixture({ id: 6, date: '2026-04-05', goalsHome: 0, goalsAway: 2 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.formString).toBe('WWDLW')
    expect(stats.recentMatches).toHaveLength(6)
  })

  it('formString is shorter when fewer than 5 finished matches exist', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', goalsHome: 2, goalsAway: 0 }),
        fixture({ id: 2, date: '2026-04-25', goalsHome: 0, goalsAway: 1 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.formString).toBe('LW')
  })

  it('filters out matches outside the 24-month window', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', goalsHome: 1, goalsAway: 0 }),
        fixture({ id: 2, date: '2023-01-01', goalsHome: 1, goalsAway: 0 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.totalMatches).toBe(1)
  })

  it('throws StatsCollectionError on FootballApi failure', async () => {
    const client = rejectingClient(new FootballApiError(500, 'boom'))
    await expect(collectTeamStats(client, TEAM_ID, NOW)).rejects.toBeInstanceOf(StatsCollectionError)
  })

  it('treats away-team perspective correctly when externalId is the away id', async () => {
    const client = fakeClient([
      wrap(
        fixture({ id: 1, date: '2026-05-01', homeId: 99, awayId: TEAM_ID, goalsHome: 0, goalsAway: 2 }),
      ),
    ])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.wins).toBe(1)
    expect(stats.goalsScored).toBe(2)
    expect(stats.goalsConceded).toBe(0)
    expect(stats.cleanSheets).toBe(1)
  })

  it('deduplicates the same fixture appearing across seasons', async () => {
    const sameFixture = fixture({ id: 999, date: '2026-05-01', goalsHome: 1, goalsAway: 0 })
    const client = fakeClient([wrap(sameFixture), wrap(sameFixture), wrap(sameFixture)])
    const stats = await collectTeamStats(client, TEAM_ID, NOW)
    expect(stats.totalMatches).toBe(1)
  })

  describe('with INSIGHT_RAW_STATS_USE_DATE_RANGE=true', () => {
    beforeEach(() => {
      vi.stubEnv('INSIGHT_RAW_STATS_USE_DATE_RANGE', 'true')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('calls fetchTeamFixturesByDateRange once with 24-month window instead of fetchTeamFixtures per season', async () => {
      const fx = fixture({ id: 1, date: '2026-05-01', goalsHome: 2, goalsAway: 0 })
      const client = fakeClient([])
      ;(client.fetchTeamFixturesByDateRange as ReturnType<typeof vi.fn>).mockResolvedValue(wrap(fx))

      const stats = await collectTeamStats(client, TEAM_ID, NOW)

      expect(client.fetchTeamFixtures).not.toHaveBeenCalled()
      expect(client.fetchTeamFixturesByDateRange).toHaveBeenCalledTimes(1)
      const call = (client.fetchTeamFixturesByDateRange as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.teamId).toBe(TEAM_ID)
      expect(call.from).toBe('2024-05-21')
      expect(call.to).toBe('2026-05-21')
      expect(stats.totalMatches).toBe(1)
      expect(stats.wins).toBe(1)
    })

    it('throws StatsCollectionError on API failure (date-range path)', async () => {
      const client = rejectingClient(new FootballApiError(429, 'Rate limit'))
      await expect(collectTeamStats(client, TEAM_ID, NOW)).rejects.toBeInstanceOf(StatsCollectionError)
      expect(client.fetchTeamFixturesByDateRange).toHaveBeenCalledTimes(1)
    })
  })
})

describe('collectMatchStats', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockInsert.mockReset()
  })

  it('fetches stats for both teams when externalIds are present', async () => {
    const matchRow = [{ homeTeamId: 'home-uuid', awayTeamId: 'away-uuid' }]
    const teamRows = [
      { id: 'home-uuid', externalId: 10 },
      { id: 'away-uuid', externalId: 20 },
    ]
    mockSelect
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve(matchRow) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve(teamRows) }),
      })

    const client = fakeClient([wrap(), wrap(), wrap(), wrap(), wrap(), wrap()])
    const stats = await collectMatchStats(client, 'match-uuid', NOW)
    expect(stats.homeTeam.externalId).toBe(10)
    expect(stats.awayTeam.externalId).toBe(20)
  })

  it('throws when home team has no externalId', async () => {
    const matchRow = [{ homeTeamId: 'home-uuid', awayTeamId: 'away-uuid' }]
    const teamRows = [
      { id: 'home-uuid', externalId: null },
      { id: 'away-uuid', externalId: 20 },
    ]
    mockSelect
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve(matchRow) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve(teamRows) }),
      })

    const client = fakeClient([])
    await expect(collectMatchStats(client, 'match-uuid', NOW)).rejects.toBeInstanceOf(StatsCollectionError)
  })

  it('throws when match is not found', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    })
    const client = fakeClient([])
    await expect(collectMatchStats(client, 'missing-uuid', NOW)).rejects.toBeInstanceOf(StatsCollectionError)
  })
})

describe('saveMatchStats', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockInsert.mockReset()
  })

  it('upserts on (match_id, type) conflict', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    mockInsert.mockReturnValue({ values })

    const stats = {
      homeTeam: {
        externalId: 10, totalMatches: 0, wins: 0, draws: 0, losses: 0, winRate: 0,
        goalsScored: 0, goalsScoredPerMatch: 0, goalsConceded: 0, goalsConcededPerMatch: 0,
        cleanSheets: 0, cleanSheetRate: 0, formString: '', recentMatches: [],
      },
      awayTeam: {
        externalId: 20, totalMatches: 0, wins: 0, draws: 0, losses: 0, winRate: 0,
        goalsScored: 0, goalsScoredPerMatch: 0, goalsConceded: 0, goalsConcededPerMatch: 0,
        cleanSheets: 0, cleanSheetRate: 0, formString: '', recentMatches: [],
      },
    }
    await saveMatchStats('match-uuid', stats)

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      matchId: 'match-uuid',
      type: 'raw_stats',
    }))
    expect(onConflictDoUpdate).toHaveBeenCalled()
  })
})
