import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, selectDistinctOn: mockSelect },
}))

import { getPlayers, countPlayersForLeague } from '../src/services/players.service.js'

const NOW = new Date('2026-01-01T00:00:00Z')

const PLAYER_ROW = {
  players: {
    id: 'p1',
    name: 'Messi',
    teamId: 't1',
    position: 'FW',
    shirtNumber: 10,
    createdAt: NOW,
    updatedAt: NOW,
  },
  teams: { id: 't1', name: 'Argentina', shortCode: 'ARG' },
}

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(result)
  chain['then'] = terminal.then.bind(terminal)
  chain['catch'] = terminal.catch.bind(terminal)
  chain['finally'] = terminal.finally.bind(terminal)
  chain['from'] = vi.fn().mockReturnValue(chain)
  chain['leftJoin'] = vi.fn().mockReturnValue(chain)
  chain['innerJoin'] = vi.fn().mockReturnValue(chain)
  chain['where'] = vi.fn().mockReturnValue(chain)
  chain['orderBy'] = vi.fn().mockReturnValue(terminal)
  return chain
}

function setupSequence(results: unknown[]): void {
  let i = 0
  mockSelect.mockImplementation(() => {
    const r = results[i] ?? []
    i++
    return makeChain(r)
  })
}

describe('getPlayers', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns all players when no filter', async () => {
    setupSequence([[PLAYER_ROW]])
    const result = await getPlayers()
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Messi')
  })

  it('filters players by leagueId via teamIdsForLeague', async () => {
    setupSequence([
      [{ id: 't1' }],
      [PLAYER_ROW],
    ])
    const result = await getPlayers({ leagueId: 'league-1' })
    expect(result).toHaveLength(1)
    expect(result[0]?.teamId).toBe('t1')
  })

  it('returns empty array when league has no teams', async () => {
    setupSequence([[]])
    const result = await getPlayers({ leagueId: 'league-empty' })
    expect(result).toEqual([])
  })
})

describe('countPlayersForLeague', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 0 when league has no teams', async () => {
    setupSequence([[]])
    expect(await countPlayersForLeague('league-empty')).toBe(0)
  })

  it('returns count when league has players', async () => {
    setupSequence([
      [{ id: 't1' }, { id: 't2' }],
      [{ count: 42 }],
    ])
    expect(await countPlayersForLeague('league-1')).toBe(42)
  })

  it('returns 0 when count query returns no rows', async () => {
    setupSequence([
      [{ id: 't1' }],
      [],
    ])
    expect(await countPlayersForLeague('league-1')).toBe(0)
  })
})
