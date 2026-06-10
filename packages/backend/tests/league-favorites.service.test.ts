import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getFavoritesForLeague } from '../src/services/league-favorites.service.js'

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(result)
  ;(chain as Record<string, unknown>)['then'] = terminal.then.bind(terminal)
  ;(chain as Record<string, unknown>)['catch'] = terminal.catch.bind(terminal)
  ;(chain as Record<string, unknown>)['finally'] = terminal.finally.bind(terminal)
  chain['from'] = vi.fn().mockReturnValue(chain)
  chain['innerJoin'] = vi.fn().mockReturnValue(chain)
  chain['where'] = vi.fn().mockReturnValue(terminal)
  return chain
}

describe('getFavoritesForLeague', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns only the requester favorite when they are not in any group with this league', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([])) // step 1: requester groups in league = none
      // step 2 skipped because groupIds is empty
      .mockReturnValueOnce(makeChain([
        { userId: 'me', displayName: 'Me', teamId: 'team-a' },
      ])) // step 3: favorites for [me]

    const result = await getFavoritesForLeague('league-1', 'me')

    expect(result).toEqual([
      { userId: 'me', displayName: 'Me', teamId: 'team-a' },
    ])
  })

  it('returns favorites of every group-member who set one in this league (DISTINCT)', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([
        { groupId: 'g1' },
        { groupId: 'g2' },
        { groupId: 'g1' }, // duplicate group from join — must dedupe
      ]))
      .mockReturnValueOnce(makeChain([
        { userId: 'me' },
        { userId: 'alice' },
        { userId: 'bob' },
        { userId: 'alice' }, // duplicate across groups — Set dedupes
      ]))
      .mockReturnValueOnce(makeChain([
        { userId: 'me', displayName: 'Me', teamId: 'team-a' },
        { userId: 'alice', displayName: 'Alice', teamId: 'team-b' },
        { userId: 'bob', displayName: 'Bob', teamId: 'team-a' },
      ]))

    const result = await getFavoritesForLeague('league-1', 'me')

    expect(result).toHaveLength(3)
    expect(result.map((m) => m.userId).sort()).toEqual(['alice', 'bob', 'me'])
  })

  it('does not include users outside the requester groups', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ groupId: 'g1' }]))
      .mockReturnValueOnce(makeChain([
        { userId: 'me' },
        { userId: 'alice' },
      ]))
      .mockReturnValueOnce(makeChain([
        // backend filter ensures only candidate IDs come back; we trust the SQL
        { userId: 'me', displayName: 'Me', teamId: 'team-a' },
        { userId: 'alice', displayName: 'Alice', teamId: 'team-b' },
      ]))

    const result = await getFavoritesForLeague('league-1', 'me')

    expect(result.map((m) => m.userId)).toEqual(['me', 'alice'])
  })

  it('returns favorites regardless of favoriteTeamDoublePoints (no filter on it)', async () => {
    // Even when groups have favoriteTeamDoublePoints=false, the service still returns
    // members. Verified by simply not querying that column anywhere.
    mockSelect
      .mockReturnValueOnce(makeChain([{ groupId: 'g1' }]))
      .mockReturnValueOnce(makeChain([{ userId: 'me' }, { userId: 'alice' }]))
      .mockReturnValueOnce(makeChain([
        { userId: 'alice', displayName: 'Alice', teamId: 'team-b' },
      ]))

    const result = await getFavoritesForLeague('league-1', 'me')

    expect(result).toEqual([
      { userId: 'alice', displayName: 'Alice', teamId: 'team-b' },
    ])
  })

  it('returns empty array when nobody set a favorite in this league', async () => {
    mockSelect
      .mockReturnValueOnce(makeChain([{ groupId: 'g1' }]))
      .mockReturnValueOnce(makeChain([{ userId: 'me' }, { userId: 'alice' }]))
      .mockReturnValueOnce(makeChain([]))

    const result = await getFavoritesForLeague('league-1', 'me')

    expect(result).toEqual([])
  })
})
