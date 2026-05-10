import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockGroupBy,
  mockOrderBy,
  mockLeftJoin,
  mockInnerJoin,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockGroupBy = vi.fn()
  const mockWhere = vi.fn()
  const mockLeftJoin = vi.fn()
  const mockInnerJoin = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()

  return { mockSelect, mockFrom, mockWhere, mockGroupBy, mockOrderBy, mockLeftJoin, mockInnerJoin }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    $with: vi.fn().mockReturnValue({ as: vi.fn() }),
  },
}))

import { getAdminStats, getAdminStatsMatches } from '../src/services/admin-stats.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupChain(resolvedValue: unknown): void {
  mockSelect.mockReturnValue({ from: mockFrom })
  mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin, where: mockWhere })
  mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin, where: mockWhere, groupBy: mockGroupBy })
  mockInnerJoin.mockReturnValue({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin, where: mockWhere, groupBy: mockGroupBy })
  mockWhere.mockReturnValue({ groupBy: mockGroupBy, orderBy: mockOrderBy })
  mockGroupBy.mockReturnValue({ orderBy: mockOrderBy })
  mockOrderBy.mockResolvedValue(resolvedValue)
}

function setupSequentialSelects(...results: unknown[]): void {
  let callIndex = 0
  mockSelect.mockImplementation(() => {
    const idx = callIndex++
    const result = results[idx] ?? []

    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.leftJoin = vi.fn().mockReturnValue(chain)
    chain.innerJoin = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn().mockReturnValue(chain)
    chain.groupBy = vi.fn().mockReturnValue(chain)
    chain.orderBy = vi.fn().mockResolvedValue(result)
    Object.defineProperty(chain, 'then', {
      value: (onFulfill: (v: unknown) => void) => Promise.resolve(result).then(onFulfill),
      enumerable: false,
    })
    return chain
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('admin-stats.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAdminStats', () => {
    it('returns zero counts for empty DB', async () => {
      setupSequentialSelects(
        [],               // userRows
        [],               // groupCountRows
        [{ matchCount: 0 }], // matchCount
        [{ activeCount: 0 }], // activeUsers7d
        [{ groupCount: 0 }],  // groupStats
        [{ avgSize: 0 }],     // avgGroupSize
      )

      const result = await getAdminStats()

      expect(result.summary.userCount).toBe(0)
      expect(result.summary.activeUsers7d).toBe(0)
      expect(result.summary.predictionCount).toBe(0)
      expect(result.summary.fillRate).toBe(0)
      expect(result.summary.groupCount).toBe(0)
      expect(result.summary.avgGroupSize).toBe(0)
      expect(result.summary.zeroTipUsers).toBe(0)
      expect(result.users).toEqual([])
    })

    it('calculates correct stats with users and predictions', async () => {
      const userRows = [
        { id: 'u1', avatarUrl: null, displayName: 'Alice', isBanned: false, tipCount: 5, points: 10, lastActivity: '2026-05-01T10:00:00Z' },
        { id: 'u2', avatarUrl: null, displayName: 'Bob', isBanned: true, tipCount: 0, points: 0, lastActivity: null },
      ]

      setupSequentialSelects(
        userRows,
        [{ userId: 'u1', groupCount: 2 }],  // groupCountRows
        [{ matchCount: 10 }],
        [{ activeCount: 1 }],
        [{ groupCount: 3 }],
        [{ avgSize: 4 }],
      )

      const result = await getAdminStats()

      expect(result.summary.userCount).toBe(2)
      expect(result.summary.predictionCount).toBe(5)
      expect(result.summary.fillRate).toBe(25) // 5 / (2*10) * 100
      expect(result.summary.activeUsers7d).toBe(1)
      expect(result.summary.groupCount).toBe(3)
      expect(result.summary.avgGroupSize).toBe(4)
      expect(result.summary.zeroTipUsers).toBe(1)

      expect(result.users).toHaveLength(2)
      expect(result.users[0]).toMatchObject({
        id: 'u1',
        displayName: 'Alice',
        tipCount: 5,
        fillPercent: 50, // 5/10 * 100
        points: 10,
        groupCount: 2,
        isBanned: false,
      })
      expect(result.users[1]).toMatchObject({
        id: 'u2',
        displayName: 'Bob',
        tipCount: 0,
        fillPercent: 0,
        points: 0,
        groupCount: 0,
        isBanned: true,
      })
    })
  })

  describe('getAdminStatsMatches', () => {
    it('returns empty array when no matches', async () => {
      setupSequentialSelects(
        [{ cnt: 5 }],  // totalUsers
        [],            // match rows
      )

      const result = await getAdminStatsMatches()

      expect(result.matches).toEqual([])
    })

    it('calculates fill percent and formats result correctly', async () => {
      const matchRows = [
        {
          matchId: 'm1',
          scheduledAt: new Date('2026-06-15T18:00:00Z'),
          homeTeamName: 'Germany',
          awayTeamName: 'France',
          tippedCount: 8,
          homeGoals: 2,
          awayGoals: 1,
        },
        {
          matchId: 'm2',
          scheduledAt: new Date('2026-06-16T20:00:00Z'),
          homeTeamName: 'Spain',
          awayTeamName: 'Italy',
          tippedCount: 5,
          homeGoals: null,
          awayGoals: null,
        },
      ]

      setupSequentialSelects(
        [{ cnt: 10 }],
        matchRows,
      )

      const result = await getAdminStatsMatches()

      expect(result.matches).toHaveLength(2)
      expect(result.matches[0]).toMatchObject({
        matchId: 'm1',
        homeTeam: 'Germany',
        awayTeam: 'France',
        tippedCount: 8,
        totalUsers: 10,
        fillPercent: 80,
        result: '2-1',
      })
      expect(result.matches[1]).toMatchObject({
        matchId: 'm2',
        homeTeam: 'Spain',
        awayTeam: 'Italy',
        tippedCount: 5,
        totalUsers: 10,
        fillPercent: 50,
        result: null,
      })
    })
  })
})
