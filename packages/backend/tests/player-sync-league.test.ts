import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelectDistinct, mockFrom, mockInnerJoin, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn().mockResolvedValue([])
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere }))
  const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }))
  const mockSelectDistinct = vi.fn(() => ({ from: mockFrom }))
  return { mockSelectDistinct, mockFrom, mockInnerJoin, mockWhere }
})

// Player upsert paths in the shared helper also hit db.select/insert/update; the
// squad/stats responses below are empty, so those are never exercised here.
vi.mock('../src/db/client.js', () => ({
  db: {
    selectDistinct: mockSelectDistinct,
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) })),
    insert: vi.fn(() => ({ values: () => ({ onConflictDoUpdate: () => Promise.resolve(undefined) }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve(undefined) }) })),
  },
}))

import { syncPlayersForLeague } from '../src/services/player-sync.service.js'
import type { FootballApiClient } from '../src/services/football-api.service.js'

function makeClient(): { client: FootballApiClient; fetchSquad: ReturnType<typeof vi.fn>; fetchPlayers: ReturnType<typeof vi.fn> } {
  const fetchSquad = vi.fn().mockResolvedValue({ results: 0, paging: { current: 1, total: 1 }, response: [] })
  const fetchPlayers = vi.fn().mockResolvedValue({ results: 0, paging: { current: 1, total: 1 }, response: [] })
  const client = { fetchTeams: vi.fn(), fetchFixtures: vi.fn(), fetchSquad, fetchPlayers, fetchEvents: vi.fn() } as unknown as FootballApiClient
  return { client, fetchSquad, fetchPlayers }
}

describe('syncPlayersForLeague (league-scoped player sync)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWhere.mockResolvedValue([])
  })

  it('syncs players for club teams too (teamType filter is gone)', async () => {
    mockWhere.mockResolvedValue([
      { id: 'team-club', externalId: 100 },
      { id: 'team-national', externalId: 200 },
    ])
    const { client, fetchSquad } = makeClient()

    await syncPlayersForLeague(client, 'league-1', 2026)

    expect(fetchSquad).toHaveBeenCalledTimes(2)
    expect(fetchSquad).toHaveBeenCalledWith({ team: 100 })
    expect(fetchSquad).toHaveBeenCalledWith({ team: 200 })
  })

  it('uses the league season, not the hardcoded SEASONS constant', async () => {
    mockWhere.mockResolvedValue([{ id: 'team-1', externalId: 100 }])
    const { client, fetchPlayers } = makeClient()

    await syncPlayersForLeague(client, 'league-1', 2027)

    expect(fetchPlayers).toHaveBeenCalledTimes(1)
    expect(fetchPlayers).toHaveBeenCalledWith({ team: 100, season: 2027, page: 1 })
    for (const call of fetchPlayers.mock.calls) {
      expect(call[0].season).toBe(2027)
    }
  })

  it('returns a PlayerSyncResult and skips teams with no external id', async () => {
    mockWhere.mockResolvedValue([])
    const { client, fetchSquad } = makeClient()

    const result = await syncPlayersForLeague(client, 'league-empty', 2026)

    expect(fetchSquad).not.toHaveBeenCalled()
    expect(result).toEqual({ inserted: 0, updated: 0, statsUpserted: 0, skipped: 0, errors: [] })
  })
})
