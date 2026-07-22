import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mocks ──────────────────────────────────────────────────────────────────

const { mockSelect, mockFrom, mockWhere, mockLimit, mockInsert, mockValues } = vi.hoisted(() => {
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  const mockValues = vi.fn().mockResolvedValue(undefined)
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  return { mockSelect, mockFrom, mockWhere, mockLimit, mockInsert, mockValues }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

const { mockRunSync } = vi.hoisted(() => ({ mockRunSync: vi.fn() }))
vi.mock('../src/services/sync.service.js', () => ({ runSync: mockRunSync }))

const { mockSyncPlayersForLeague } = vi.hoisted(() => ({ mockSyncPlayersForLeague: vi.fn() }))
vi.mock('../src/services/player-sync.service.js', () => ({ syncPlayersForLeague: mockSyncPlayersForLeague }))

const { mockBuildConfig, mockCreateFootballApiClient } = vi.hoisted(() => ({
  mockBuildConfig: vi.fn(() => ({})),
  mockCreateFootballApiClient: vi.fn(() => ({ id: 'client' })),
}))
vi.mock('../src/services/football-api.service.js', () => ({
  buildConfig: mockBuildConfig,
  createFootballApiClient: mockCreateFootballApiClient,
}))

import { runLeagueSync } from '../src/services/league-sync.service.js'

const NOW = new Date('2026-07-21T00:00:00.000Z')

const ACTIVE_ROW = {
  id: 'league-1',
  name: 'Premier League',
  shortName: 'PL',
  startsAt: null,
  status: 'active' as 'active' | 'archived',
  syncEnabled: true,
  externalId: 39 as number | null,
  season: 2026 as number | null,
  syncFrom: null as Date | null,
  syncTo: null as Date | null,
  fixtureAllowlist: null as number[] | null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null as Date | null,
}

function setLeagueRow(row: unknown): void {
  mockLimit.mockResolvedValue(row === null ? [] : [row])
}

describe('runLeagueSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLimit.mockResolvedValue([])
    mockRunSync.mockResolvedValue({ teamsUpserted: 5, fixturesUpserted: 10, resultsUpserted: 3, errors: [], partial: false })
    mockSyncPlayersForLeague.mockResolvedValue({ inserted: 7, updated: 2, statsUpserted: 4, skipped: 0, errors: [] })
  })

  it('rejects an unknown league with 404 and never calls runSync', async () => {
    setLeagueRow(null)
    await expect(runLeagueSync('missing', 'actor-1')).rejects.toMatchObject({ status: 404 })
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('rejects a league with no external_id (400) and never calls runSync', async () => {
    setLeagueRow({ ...ACTIVE_ROW, externalId: null })
    await expect(runLeagueSync('league-1', 'actor-1')).rejects.toMatchObject({ status: 400 })
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('rejects an archived league (409) and never calls runSync', async () => {
    setLeagueRow({ ...ACTIVE_ROW, status: 'archived' })
    await expect(runLeagueSync('league-1', 'actor-1')).rejects.toMatchObject({ status: 409 })
    expect(mockRunSync).not.toHaveBeenCalled()
  })

  it('calls runSync with correctly mapped options for an active league', async () => {
    setLeagueRow({ ...ACTIVE_ROW, syncFrom: new Date('2026-06-01T00:00:00.000Z'), syncTo: new Date('2026-07-01T00:00:00.000Z'), fixtureAllowlist: [1, 2] })
    await runLeagueSync('league-1', 'actor-1')
    expect(mockRunSync).toHaveBeenCalledOnce()
    const opts = mockRunSync.mock.calls[0][0]
    expect(opts).toMatchObject({
      leagueExternalId: 39,
      leagueInternalId: 'league-1',
      season: 2026,
      dateRange: { from: '2026-06-01T00:00:00.000Z', to: '2026-07-01T00:00:00.000Z' },
      fixtureAllowlist: [1, 2],
    })
  })

  it('runs match+team sync before players, then returns a merged summary', async () => {
    setLeagueRow(ACTIVE_ROW)
    const order: string[] = []
    mockRunSync.mockImplementation(async () => { order.push('runSync'); return { teamsUpserted: 5, fixturesUpserted: 10, resultsUpserted: 3, errors: [], partial: false } })
    mockSyncPlayersForLeague.mockImplementation(async () => { order.push('players'); return { inserted: 7, updated: 2, statsUpserted: 4, skipped: 0, errors: [] } })

    const summary = await runLeagueSync('league-1', 'actor-1')

    expect(order).toEqual(['runSync', 'players'])
    expect(mockSyncPlayersForLeague).toHaveBeenCalledWith(expect.anything(), 'league-1', 2026)
    expect(summary).toMatchObject({ matchesUpserted: 10, teamsUpserted: 5, playersUpserted: 9 })
  })

  it('writes a league_sync_run audit log', async () => {
    setLeagueRow(ACTIVE_ROW)
    await runLeagueSync('league-1', 'actor-9')
    expect(mockInsert).toHaveBeenCalled()
    const audited = mockValues.mock.calls.find(c => c[0]?.action === 'league_sync_run')
    expect(audited).toBeDefined()
    expect(audited?.[0]).toMatchObject({ action: 'league_sync_run', entityType: 'league', entityId: 'league-1', actorId: 'actor-9' })
  })
})
