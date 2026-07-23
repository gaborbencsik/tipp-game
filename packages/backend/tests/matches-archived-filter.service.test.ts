import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the conditions passed into the final `and(...)` so we can assert
// the archived-league filter is present by default and absent when opted out.

const { mockOrderBy, mockWhere, mockLeftJoin, mockFrom, mockSelect, andCalls, orCalls } =
  vi.hoisted(() => {
    const andCalls: unknown[][] = []
    const orCalls: unknown[][] = []
    const mockOrderBy = vi.fn().mockResolvedValue([])
    const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }))
    const mockLeftJoin = vi.fn(function () {
      return { leftJoin: mockLeftJoin, where: mockWhere }
    })
    const mockFrom = vi.fn(() => ({ leftJoin: mockLeftJoin, where: mockWhere }))
    const mockSelect = vi.fn(() => ({ from: mockFrom }))
    return { mockOrderBy, mockWhere, mockLeftJoin, mockFrom, mockSelect, andCalls, orCalls }
  })

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    and: (...args: unknown[]) => {
      andCalls.push(args)
      return actual.and(...(args as Parameters<typeof actual.and>))
    },
    or: (...args: unknown[]) => {
      orCalls.push(args)
      return actual.or(...(args as Parameters<typeof actual.or>))
    },
  }
})

vi.mock('../src/services/scoring.service.js', () => ({
  calculateAndSavePoints: vi.fn(),
  calculateAndSaveGroupPoints: vi.fn(),
}))

import { getMatches } from '../src/services/matches.service.js'

describe('getMatches archived-league filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    andCalls.length = 0
    orCalls.length = 0
    mockOrderBy.mockResolvedValue([])
  })

  it('default → adds an OR(leagueId IS NULL, leagues.status = active) condition', async () => {
    await getMatches()

    // exactly one or() built for the archived filter, with two operands
    expect(orCalls).toHaveLength(1)
    expect(orCalls[0] as unknown[]).toHaveLength(2)
  })

  it('includeArchivedLeagues: true → no archived or-condition added', async () => {
    await getMatches({ includeArchivedLeagues: true })

    expect(orCalls).toHaveLength(0)
  })

  // US-953 fix: hand-picked matches may live in ANY (incl. archived) league, so
  // when matchIds is supplied the default archived filter must let them through.
  it('matchIds → archived or-condition gains the matchIds operand (3 operands)', async () => {
    await getMatches({ matchIds: ['m-1', 'm-2'] })

    expect(orCalls).toHaveLength(1)
    expect(orCalls[0] as unknown[]).toHaveLength(3)
  })

  it('leagueIds + matchIds → builds a scope or() with two operands', async () => {
    await getMatches({ leagueIds: ['l-1'], matchIds: ['m-1'] })

    // one or() for the (league ∪ match) scope, one for the archived filter
    expect(orCalls).toHaveLength(2)
    const scope = orCalls.find((c) => c.length === 2)
    expect(scope).toBeDefined()
  })
})
