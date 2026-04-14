import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockLimit, mockMemberWhere, mockMemberFrom,
  mockGroupWhere, mockGroupFrom, mockSelect,
  mockOrderBy, mockGroupBy, mockLeftJoin,
  mockInnerJoin, mockLeaderboardWhere, mockLeaderboardFrom,
  mockLeftJoin2,
} = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockMemberWhere: vi.fn(),
  mockMemberFrom: vi.fn(),
  mockGroupWhere: vi.fn(),
  mockGroupFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockOrderBy: vi.fn(),
  mockGroupBy: vi.fn(),
  mockLeftJoin: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockLeaderboardWhere: vi.fn(),
  mockLeaderboardFrom: vi.fn(),
  mockLeftJoin2: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

vi.mock('../src/db/schema/index.js', () => ({
  users: { id: 'users.id', displayName: 'users.displayName', avatarUrl: 'users.avatarUrl' },
  predictions: { pointsGlobal: 'predictions.pointsGlobal', id: 'predictions.id', userId: 'predictions.userId' },
  groups: { id: 'groups.id', scoringConfigId: 'groups.scoringConfigId' },
  groupMembers: { groupId: 'groupMembers.groupId', userId: 'groupMembers.userId' },
  groupPredictionPoints: { points: 'gpp.points', id: 'gpp.id', predictionId: 'gpp.predictionId', groupId: 'gpp.groupId' },
  scoringConfigs: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: Object.assign(vi.fn(() => 'sql-expr'), { raw: vi.fn() }),
  count: vi.fn(() => 'count-expr'),
}))

import { getGroupLeaderboard } from '../src/services/group-leaderboard.service.js'

const GROUP_ID = 'group-uuid-1'
const REQUESTER_ID = 'user-uuid-1'

const GROUP_ROW_NO_CONFIG = { id: GROUP_ID, scoringConfigId: null }
const GROUP_ROW_WITH_CONFIG = { id: GROUP_ID, scoringConfigId: 'config-uuid-1' }
const MEMBER_ROWS = [{ userId: REQUESTER_ID }, { userId: 'user-uuid-2' }]
const LEADERBOARD_ROWS = [
  { userId: REQUESTER_ID, displayName: 'Alice', avatarUrl: null, totalPoints: 10, predictionCount: 3, correctCount: 2 },
  { userId: 'user-uuid-2', displayName: 'Bob', avatarUrl: null, totalPoints: 5, predictionCount: 2, correctCount: 1 },
]

function setupLeaderboardSelectChain(groupRow: unknown, memberRows: unknown[], leaderboardRows: unknown[], withConfig = false) {
  mockLimit.mockResolvedValueOnce([groupRow])
  mockGroupWhere.mockReturnValue({ limit: mockLimit })
  mockGroupFrom.mockReturnValue({ where: mockGroupWhere })

  mockMemberWhere.mockResolvedValueOnce(memberRows)
  mockMemberFrom.mockReturnValue({ where: mockMemberWhere })

  mockOrderBy.mockResolvedValueOnce(leaderboardRows)
  mockGroupBy.mockReturnValue({ orderBy: mockOrderBy })
  mockLeaderboardWhere.mockReturnValue({ groupBy: mockGroupBy })

  if (withConfig) {
    // has 2 leftJoins (predictions + groupPredictionPoints)
    mockLeftJoin2.mockReturnValue({ where: mockLeaderboardWhere })
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin2 })
  } else {
    // has 1 leftJoin (predictions only)
    mockLeftJoin.mockReturnValue({ where: mockLeaderboardWhere })
  }

  mockInnerJoin.mockReturnValue({ leftJoin: mockLeftJoin })
  mockLeaderboardFrom.mockReturnValue({ innerJoin: mockInnerJoin })

  mockSelect
    .mockReturnValueOnce({ from: mockGroupFrom })
    .mockReturnValueOnce({ from: mockMemberFrom })
    .mockReturnValueOnce({ from: mockLeaderboardFrom })
}

describe('getGroupLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ranked entries for group members (global scoring fallback)', async () => {
    setupLeaderboardSelectChain(GROUP_ROW_NO_CONFIG, MEMBER_ROWS, LEADERBOARD_ROWS)

    const result = await getGroupLeaderboard(GROUP_ID, REQUESTER_ID)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ rank: 1, userId: REQUESTER_ID, totalPoints: 10 })
    expect(result[1]).toMatchObject({ rank: 2, userId: 'user-uuid-2', totalPoints: 5 })
  })

  it('uses groupPredictionPoints when group has scoring config', async () => {
    setupLeaderboardSelectChain(GROUP_ROW_WITH_CONFIG, MEMBER_ROWS, LEADERBOARD_ROWS, true)

    const result = await getGroupLeaderboard(GROUP_ID, REQUESTER_ID)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ rank: 1, userId: REQUESTER_ID, totalPoints: 10 })
  })

  it('throws 404 if group not found', async () => {
    mockLimit.mockResolvedValueOnce([])
    mockGroupWhere.mockReturnValue({ limit: mockLimit })
    mockGroupFrom.mockReturnValue({ where: mockGroupWhere })
    mockSelect.mockReturnValueOnce({ from: mockGroupFrom })

    await expect(getGroupLeaderboard(GROUP_ID, REQUESTER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('throws 403 if requester is not a member', async () => {
    mockLimit.mockResolvedValueOnce([GROUP_ROW_NO_CONFIG])
    mockGroupWhere.mockReturnValue({ limit: mockLimit })
    mockGroupFrom.mockReturnValue({ where: mockGroupWhere })
    mockMemberWhere.mockResolvedValueOnce([{ userId: 'other-user' }])
    mockMemberFrom.mockReturnValue({ where: mockMemberWhere })

    mockSelect
      .mockReturnValueOnce({ from: mockGroupFrom })
      .mockReturnValueOnce({ from: mockMemberFrom })

    await expect(getGroupLeaderboard(GROUP_ID, REQUESTER_ID)).rejects.toMatchObject({ status: 403 })
  })

  it('tied ranks share the same rank number', async () => {
    const tiedRows = [
      { userId: 'u1', displayName: 'Alice', avatarUrl: null, totalPoints: 10, predictionCount: 2, correctCount: 1 },
      { userId: 'u2', displayName: 'Bob', avatarUrl: null, totalPoints: 10, predictionCount: 2, correctCount: 1 },
      { userId: 'u3', displayName: 'Carol', avatarUrl: null, totalPoints: 5, predictionCount: 1, correctCount: 0 },
    ]
    setupLeaderboardSelectChain(GROUP_ROW_NO_CONFIG, [{ userId: REQUESTER_ID }, { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }], tiedRows, false)

    const result = await getGroupLeaderboard(GROUP_ID, REQUESTER_ID)

    expect(result[0]?.rank).toBe(1)
    expect(result[1]?.rank).toBe(1)
    expect(result[2]?.rank).toBe(3)
  })
})
