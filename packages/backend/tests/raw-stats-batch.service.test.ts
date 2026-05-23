import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FootballApiClient } from '../src/services/football-api.service.js'
import type { TeamStats } from '../src/services/insights/stats.types.js'

const { mockSelect, mockCollectTeamStats, mockSaveMatchStats } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockCollectTeamStats: vi.fn(),
  mockSaveMatchStats: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

vi.mock('../src/services/insights/stats-collector.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/insights/stats-collector.service.js')>()
  return {
    ...actual,
    collectTeamStats: mockCollectTeamStats,
    saveMatchStats: mockSaveMatchStats,
  }
})

import { runRawStatsCollection } from '../src/services/insights/raw-stats-batch.service.js'

interface MatchRow { id: string; homeTeamId: string; awayTeamId: string }

function emptyClient(): FootballApiClient {
  return {
    fetchFixtures: vi.fn(),
    fetchTeams: vi.fn(),
    fetchSquad: vi.fn(),
    fetchPlayers: vi.fn(),
    fetchTeamFixtures: vi.fn(),
  }
}

function teamStats(externalId: number): TeamStats {
  return {
    externalId,
    totalMatches: 0, wins: 0, draws: 0, losses: 0, winRate: 0,
    goalsScored: 0, goalsScoredPerMatch: 0, goalsConceded: 0, goalsConcededPerMatch: 0,
    cleanSheets: 0, cleanSheetRate: 0, formString: '', recentMatches: [],
  }
}

function setupQueries(opts: {
  scheduled: MatchRow[]
  freshMatchIds?: string[]
  teams: Array<{ id: string; externalId: number | null }>
}): void {
  const calls: Array<() => unknown> = []
  calls.push(() => ({ from: () => ({ where: () => Promise.resolve(opts.scheduled) }) }))
  if (opts.scheduled.length > 0) {
    if (opts.freshMatchIds !== undefined) {
      const fresh = opts.freshMatchIds.map((matchId) => ({ matchId }))
      calls.push(() => ({ from: () => ({ where: () => Promise.resolve(fresh) }) }))
    }
    calls.push(() => ({ from: () => ({ where: () => Promise.resolve(opts.teams) }) }))
  }
  for (const c of calls) mockSelect.mockReturnValueOnce(c())
}

describe('runRawStatsCollection', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockCollectTeamStats.mockReset()
    mockSaveMatchStats.mockReset().mockResolvedValue(undefined)
  })

  it('returns zeros when no scheduled matches exist', async () => {
    setupQueries({ scheduled: [], teams: [] })
    const result = await runRawStatsCollection(emptyClient(), { skipFresh: false })
    expect(result).toEqual({ processed: 0, skipped: 0, errors: [], apiCalls: 0, durationMs: expect.any(Number) })
    expect(mockCollectTeamStats).not.toHaveBeenCalled()
  })

  it('caches per-team: 2 matches sharing teams = 2 collectTeamStats calls', async () => {
    setupQueries({
      scheduled: [
        { id: 'm1', homeTeamId: 'a', awayTeamId: 'b' },
        { id: 'm2', homeTeamId: 'b', awayTeamId: 'a' },
      ],
      teams: [
        { id: 'a', externalId: 100 },
        { id: 'b', externalId: 200 },
      ],
    })
    mockCollectTeamStats.mockImplementation((_c, externalId: number) => Promise.resolve(teamStats(externalId)))

    const result = await runRawStatsCollection(emptyClient(), { skipFresh: false })

    expect(mockCollectTeamStats).toHaveBeenCalledTimes(2)
    expect(mockSaveMatchStats).toHaveBeenCalledTimes(2)
    expect(result.processed).toBe(2)
    expect(result.errors).toEqual([])
    expect(result.apiCalls).toBe(2 * 3) // 2 unique teams × 3 seasons
  })

  it('counts apiCalls as uniqueExternalIds * 3 (seasons)', async () => {
    setupQueries({
      scheduled: [
        { id: 'm1', homeTeamId: 'a', awayTeamId: 'b' },
        { id: 'm2', homeTeamId: 'c', awayTeamId: 'd' },
      ],
      teams: [
        { id: 'a', externalId: 1 },
        { id: 'b', externalId: 2 },
        { id: 'c', externalId: 3 },
        { id: 'd', externalId: 4 },
      ],
    })
    mockCollectTeamStats.mockImplementation((_c, externalId: number) => Promise.resolve(teamStats(externalId)))

    const result = await runRawStatsCollection(emptyClient(), { skipFresh: false })
    expect(result.apiCalls).toBe(4 * 3)
    expect(result.processed).toBe(2)
  })

  it('reports error for match where a team has no externalId, but processes others', async () => {
    setupQueries({
      scheduled: [
        { id: 'm1', homeTeamId: 'a', awayTeamId: 'b' },
        { id: 'm2', homeTeamId: 'c', awayTeamId: 'd' },
      ],
      teams: [
        { id: 'a', externalId: 1 },
        { id: 'b', externalId: null },
        { id: 'c', externalId: 3 },
        { id: 'd', externalId: 4 },
      ],
    })
    mockCollectTeamStats.mockImplementation((_c, externalId: number) => Promise.resolve(teamStats(externalId)))

    const result = await runRawStatsCollection(emptyClient(), { skipFresh: false })
    expect(result.processed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.matchId).toBe('m1')
    expect(result.errors[0]?.error).toMatch(/Away team has no externalId/)
  })

  it('skipFresh excludes matches with recent raw_stats and reduces apiCalls accordingly', async () => {
    setupQueries({
      scheduled: [
        { id: 'm1', homeTeamId: 'a', awayTeamId: 'b' },
        { id: 'm2', homeTeamId: 'c', awayTeamId: 'd' },
      ],
      freshMatchIds: ['m1'],
      teams: [
        { id: 'c', externalId: 3 },
        { id: 'd', externalId: 4 },
      ],
    })
    mockCollectTeamStats.mockImplementation((_c, externalId: number) => Promise.resolve(teamStats(externalId)))

    const result = await runRawStatsCollection(emptyClient(), { skipFresh: true })
    expect(result.skipped).toBe(1)
    expect(result.processed).toBe(1)
    expect(result.apiCalls).toBe(2 * 3) // only m2's teams fetched
    expect(mockCollectTeamStats).toHaveBeenCalledTimes(2)
  })

  it('returns early when all matches are fresh', async () => {
    setupQueries({
      scheduled: [{ id: 'm1', homeTeamId: 'a', awayTeamId: 'b' }],
      freshMatchIds: ['m1'],
      teams: [],
    })
    const result = await runRawStatsCollection(emptyClient(), { skipFresh: true })
    expect(result.skipped).toBe(1)
    expect(result.processed).toBe(0)
    expect(result.apiCalls).toBe(0)
    expect(mockCollectTeamStats).not.toHaveBeenCalled()
  })

  it('records error when collectTeamStats fails for a cached team', async () => {
    setupQueries({
      scheduled: [
        { id: 'm1', homeTeamId: 'a', awayTeamId: 'b' },
        { id: 'm2', homeTeamId: 'a', awayTeamId: 'c' },
      ],
      teams: [
        { id: 'a', externalId: 1 },
        { id: 'b', externalId: 2 },
        { id: 'c', externalId: 3 },
      ],
    })
    mockCollectTeamStats.mockImplementation((_c, externalId: number) => {
      if (externalId === 1) return Promise.reject(new Error('boom'))
      return Promise.resolve(teamStats(externalId))
    })

    const result = await runRawStatsCollection(emptyClient(), { skipFresh: false })
    expect(result.processed).toBe(0)
    expect(result.errors).toHaveLength(2)
    expect(result.errors.every((e) => /boom/.test(e.error))).toBe(true)
  })
})
