import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db/client.js', () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  }
  const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => ({ set: updateSet })),
      insert: vi.fn(),
    },
    __selectChain: selectChain,
    __updateSet: updateSet,
  }
})

import { db } from '../src/db/client.js'
import { syncScorerPlayerIds } from '../src/services/sync.service.js'
import type { ApiFootballFixtureEvent, ApiFootballResponse } from '../src/types/index.js'
import type { FootballApiClient } from '../src/services/football-api.service.js'

const dbMock = db as unknown as {
  select: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = (await import('../src/db/client.js')) as any
const selectChain = mod.__selectChain as { from: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> }
const updateSet = mod.__updateSet as ReturnType<typeof vi.fn>

function makeEventsResponse(events: readonly ApiFootballFixtureEvent[]): ApiFootballResponse<ApiFootballFixtureEvent> {
  return { results: events.length, paging: { current: 1, total: 1 }, response: events }
}

function makeClient(impl: () => Promise<ApiFootballResponse<ApiFootballFixtureEvent>>): FootballApiClient {
  return {
    fetchFixtureEvents: vi.fn().mockImplementation(impl),
    fetchFixtures: vi.fn(),
    fetchTeams: vi.fn(),
    fetchSquad: vi.fn(),
    fetchPlayers: vi.fn(),
    fetchTeamFixtures: vi.fn(),
    fetchTeamFixturesByDateRange: vi.fn(),
  } as unknown as FootballApiClient
}

const goalEvent: ApiFootballFixtureEvent = {
  time: { elapsed: 22, extra: null },
  team: { id: 1, name: 'Team', logo: '' },
  player: { id: 5544, name: 'Messi' },
  assist: { id: null, name: null },
  type: 'Goal',
  detail: 'Normal Goal',
  comments: null,
}

describe('syncScorerPlayerIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue([{ id: 'player-uuid', externalId: 5544 }])
    dbMock.select.mockReturnValue(selectChain)
    dbMock.update.mockReturnValue({ set: updateSet })
    updateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
  })

  it('updates match_results.scorerPlayerIds with the mapped UUIDs', async () => {
    const client = makeClient(async () => makeEventsResponse([goalEvent]))

    await syncScorerPlayerIds({ matchId: 'match-uuid-1', externalFixtureId: 999, client })

    expect(client.fetchFixtureEvents).toHaveBeenCalledWith({ fixtureId: 999 })
    expect(updateSet).toHaveBeenCalledWith({ scorerPlayerIds: ['player-uuid'] })
  })

  it('writes empty array when no goal events', async () => {
    selectChain.where.mockResolvedValue([])
    const client = makeClient(async () => makeEventsResponse([]))

    await syncScorerPlayerIds({ matchId: 'match-uuid-2', externalFixtureId: 999, client })

    expect(updateSet).toHaveBeenCalledWith({ scorerPlayerIds: [] })
  })

  it('swallows API errors and does not throw', async () => {
    const client = makeClient(async () => { throw new Error('API down') })

    await expect(
      syncScorerPlayerIds({ matchId: 'match-uuid-3', externalFixtureId: 999, client })
    ).resolves.toBeUndefined()

    expect(updateSet).not.toHaveBeenCalled()
  })

  it('skips events whose external player.id is not in the players table (drops with warning)', async () => {
    selectChain.where.mockResolvedValue([])
    const client = makeClient(async () => makeEventsResponse([
      { ...goalEvent, player: { id: 99999, name: 'Unknown' } },
    ]))

    await syncScorerPlayerIds({ matchId: 'match-uuid-4', externalFixtureId: 999, client })

    expect(updateSet).toHaveBeenCalledWith({ scorerPlayerIds: [] })
  })
})
