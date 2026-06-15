import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockFrom, mockLeftJoin, mockInnerJoin, mockWhere, mockOrderBy, mockGroupBy } = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  // groupBy must be both chainable (.orderBy(...)) AND thenable (terminal in
  // the tournament-points query that ends with .groupBy()).
  const makeGroupByResult = () => Object.assign(Promise.resolve([]), { orderBy: mockOrderBy })
  const mockGroupBy = vi.fn(makeGroupByResult)
  const mockWhere = vi.fn(() => ({ groupBy: mockGroupBy, orderBy: mockOrderBy }))
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere, orderBy: mockOrderBy }))
  const mockLeftJoin = vi.fn(function () {
    return { leftJoin: mockLeftJoin, where: mockWhere, groupBy: mockGroupBy }
  })
  const mockFrom = vi.fn(() => ({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockSelect, mockFrom, mockLeftJoin, mockInnerJoin, mockWhere, mockOrderBy, mockGroupBy }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getLeaderboard } from '../src/services/leaderboard.service.js'

const ROW = (overrides: Partial<{
  userId: string; displayName: string; avatarUrl: string | null;
  totalPoints: number; predictionCount: number; correctCount: number;
  scorerBonusPoints: number; matchCorrectCount: number; scorerCorrectCount: number;
}> = {}) => ({
  userId: 'user-1',
  displayName: 'Alice',
  avatarUrl: null,
  totalPoints: 9,
  predictionCount: 3,
  correctCount: 1,
  scorerBonusPoints: 0,
  matchCorrectCount: 1,
  scorerCorrectCount: 0,
  ...overrides,
})

describe('getLeaderboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockOrderBy.mockResolvedValue([])
    // groupBy result is both awaitable (terminal — used by tournament query)
    // and chainable (.orderBy(...) for the main aggregation query).
    mockGroupBy.mockImplementation(() => Object.assign(Promise.resolve([]), { orderBy: mockOrderBy }))
    mockWhere.mockReturnValue({ groupBy: mockGroupBy, orderBy: mockOrderBy })
    mockInnerJoin.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy })
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere, groupBy: mockGroupBy })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin })
    mockSelect.mockReturnValue({ from: mockFrom })
  })

  it('empty DB → returns []', async () => {
    mockOrderBy.mockResolvedValue([])
    const result = await getLeaderboard()
    expect(result).toEqual([])
  })

  it('single user → correct LeaderboardEntry shape', async () => {
    mockOrderBy.mockResolvedValue([ROW()])
    const result = await getLeaderboard()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      rank: 1,
      userId: 'user-1',
      displayName: 'Alice',
      avatarUrl: null,
      totalPoints: 9,
      predictionCount: 3,
      correctCount: 1,
    })
  })

  it('multiple users → sorted by totalPoints desc, rank assigned correctly', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', displayName: 'Alice', totalPoints: 9 }),
      ROW({ userId: 'user-2', displayName: 'Bob', totalPoints: 6 }),
      ROW({ userId: 'user-3', displayName: 'Carol', totalPoints: 3 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(2)
    expect(result[2].rank).toBe(3)
    expect(result[0].totalPoints).toBe(9)
    expect(result[2].totalPoints).toBe(3)
  })

  it('tied users → same rank', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', displayName: 'Alice', totalPoints: 9 }),
      ROW({ userId: 'user-2', displayName: 'Bob', totalPoints: 9 }),
      ROW({ userId: 'user-3', displayName: 'Carol', totalPoints: 3 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].rank).toBe(1)
    expect(result[1].rank).toBe(1)
    expect(result[2].rank).toBe(3)
  })

  it('null totalPoints treated as 0', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', displayName: 'Alice', totalPoints: 0 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].totalPoints).toBe(0)
  })

  // ─── UX-034: matchPoints / scorerBonusPoints / successRate ─────────────────

  it('matchPoints = totalPoints - scorerBonusPoints', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', totalPoints: 10, scorerBonusPoints: 3 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].matchPoints).toBe(7)
    expect(result[0].scorerBonusPoints).toBe(3)
  })

  it('successRate = round(correctCount / predictionCount * 100)', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', predictionCount: 3, correctCount: 2 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].successRate).toBe(67)
  })

  it('successRate = 0 when no correct predictions', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', predictionCount: 5, correctCount: 0 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].successRate).toBe(0)
  })

  it('successRate = 100 when all correct', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', predictionCount: 4, correctCount: 4 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].successRate).toBe(100)
  })

  it('successRate = null when predictionCount = 0', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', predictionCount: 0, correctCount: 0 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].successRate).toBeNull()
  })

  it('matchSuccessRate / scorerSuccessRate computed from per-category counts', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', predictionCount: 6, matchCorrectCount: 2, scorerCorrectCount: 4 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].matchSuccessRate).toBe(33)
    expect(result[0].scorerSuccessRate).toBe(67)
  })

  it('matchSuccessRate / scorerSuccessRate are null when predictionCount = 0', async () => {
    mockOrderBy.mockResolvedValue([
      ROW({ userId: 'user-1', predictionCount: 0, matchCorrectCount: 0, scorerCorrectCount: 0 }),
    ])
    const result = await getLeaderboard()
    expect(result[0].matchSuccessRate).toBeNull()
    expect(result[0].scorerSuccessRate).toBeNull()
  })
})
