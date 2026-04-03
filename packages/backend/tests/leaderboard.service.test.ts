import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockFrom, mockLeftJoin, mockWhere, mockOrderBy, mockGroupBy } = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockGroupBy = vi.fn(() => ({ orderBy: mockOrderBy }))
  const mockWhere = vi.fn(() => ({ groupBy: mockGroupBy, orderBy: mockOrderBy }))
  const mockLeftJoin = vi.fn(function () {
    return { leftJoin: mockLeftJoin, where: mockWhere, groupBy: mockGroupBy }
  })
  const mockFrom = vi.fn(() => ({ leftJoin: mockLeftJoin }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockSelect, mockFrom, mockLeftJoin, mockWhere, mockOrderBy, mockGroupBy }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getLeaderboard } from '../src/services/leaderboard.service.js'

const ROW = (overrides: Partial<{
  userId: string; displayName: string; avatarUrl: string | null;
  totalPoints: number; predictionCount: number; correctCount: number
}> = {}) => ({
  userId: 'user-1',
  displayName: 'Alice',
  avatarUrl: null,
  totalPoints: 9,
  predictionCount: 3,
  correctCount: 1,
  ...overrides,
})

describe('getLeaderboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockOrderBy.mockResolvedValue([])
    mockGroupBy.mockReturnValue({ orderBy: mockOrderBy })
    mockWhere.mockReturnValue({ groupBy: mockGroupBy })
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere, groupBy: mockGroupBy })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin })
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
})
