import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockFrom, mockLeftJoin, mockInnerJoin, mockWhere, mockOrderBy, mockGroupBy } = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  // groupBy must be both chainable (.orderBy(...)) AND thenable (terminal in
  // the tournament-points query that ends with .groupBy()).
  const makeGroupByResult = () => Object.assign(Promise.resolve([]), { orderBy: mockOrderBy })
  const mockGroupBy = vi.fn(makeGroupByResult)
  // where must be chainable (.groupBy/.orderBy) AND thenable — UX-046's
  // tournament-max query ends with .where() as its terminal step.
  const makeWhereResult = () => Object.assign(Promise.resolve([]), { groupBy: mockGroupBy, orderBy: mockOrderBy })
  const mockWhere = vi.fn(makeWhereResult)
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere, orderBy: mockOrderBy }))
  const mockLeftJoin = vi.fn(function () {
    return { leftJoin: mockLeftJoin, where: mockWhere, groupBy: mockGroupBy }
  })
  const mockFrom = vi.fn(() => ({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin, where: mockWhere }))
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
    // where is also thenable (UX-046 tournament-max query is terminal on where).
    mockWhere.mockImplementation(() => Object.assign(Promise.resolve([]), { groupBy: mockGroupBy, orderBy: mockOrderBy }))
    mockInnerJoin.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy })
    mockLeftJoin.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere, groupBy: mockGroupBy })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, innerJoin: mockInnerJoin, where: mockWhere })
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

  // ─── UX-046: tournamentMaxPoints + tournamentSuccessRate ───────────────────

  it('tournamentSuccessRate is null when no global type has been resolved', async () => {
    mockOrderBy.mockResolvedValue([ROW({ userId: 'user-1', totalPoints: 0 })])
    // favorites (2nd orderBy call) resolves to [] via default in beforeEach for
    // subsequent calls — reset only affects the first call, so re-establish it.
    mockOrderBy.mockResolvedValueOnce([ROW({ userId: 'user-1', totalPoints: 0 })])
    mockOrderBy.mockResolvedValueOnce([])
    mockGroupBy.mockImplementation(() => Object.assign(Promise.resolve([]), { orderBy: mockOrderBy }))
    // tournamentMax query terminates on where() with an empty rows array → sum = 0.
    mockWhere.mockImplementation(() => Object.assign(Promise.resolve([]), { groupBy: mockGroupBy, orderBy: mockOrderBy }))

    const result = await getLeaderboard()

    expect(result[0].tournamentMaxPoints).toBe(0)
    expect(result[0].tournamentSuccessRate).toBeNull()
  })

  it('tournamentSuccessRate = 100 when user earned every resolved point', async () => {
    mockOrderBy.mockResolvedValueOnce([ROW({ userId: 'user-1', totalPoints: 0 })])
    mockOrderBy.mockResolvedValueOnce([])
    mockGroupBy.mockImplementation(() => Object.assign(Promise.resolve([{ userId: 'user-1', tournamentPoints: 5 }]), { orderBy: mockOrderBy }))
    // Simple type (e.g. 'text') with points=5 → computeTypeMaxPoints returns 5.
    mockWhere.mockImplementation(() => Object.assign(
      Promise.resolve([{ inputType: 'text', options: null, points: 5, correctAnswer: 'x' }]),
      { groupBy: mockGroupBy, orderBy: mockOrderBy },
    ))

    const result = await getLeaderboard()

    expect(result[0].tournamentMaxPoints).toBe(5)
    expect(result[0].specialPredictionPoints).toBe(5)
    expect(result[0].tournamentSuccessRate).toBe(100)
  })

  it('tournamentSuccessRate = round(specialPredictionPoints / max * 100)', async () => {
    mockOrderBy.mockResolvedValueOnce([ROW({ userId: 'user-1', totalPoints: 0 })])
    mockOrderBy.mockResolvedValueOnce([])
    mockGroupBy.mockImplementation(() => Object.assign(Promise.resolve([{ userId: 'user-1', tournamentPoints: 6 }]), { orderBy: mockOrderBy }))
    // Two simple types → summed max = 15.
    mockWhere.mockImplementation(() => Object.assign(Promise.resolve([
      { inputType: 'text', options: null, points: 10, correctAnswer: 'a' },
      { inputType: 'dropdown', options: null, points: 5, correctAnswer: 'b' },
    ]), { groupBy: mockGroupBy, orderBy: mockOrderBy }))

    const result = await getLeaderboard()

    expect(result[0].tournamentMaxPoints).toBe(15)
    expect(result[0].tournamentSuccessRate).toBe(40)
  })

  it('every entry shares the same tournamentMaxPoints scalar', async () => {
    mockOrderBy.mockResolvedValueOnce([
      ROW({ userId: 'user-1', totalPoints: 0 }),
      ROW({ userId: 'user-2', displayName: 'Bob', totalPoints: 0 }),
    ])
    mockOrderBy.mockResolvedValueOnce([])
    mockGroupBy.mockImplementation(() => Object.assign(Promise.resolve([
      { userId: 'user-1', tournamentPoints: 6 },
      { userId: 'user-2', tournamentPoints: 3 },
    ]), { orderBy: mockOrderBy }))
    mockWhere.mockImplementation(() => Object.assign(
      Promise.resolve([{ inputType: 'text', options: null, points: 10, correctAnswer: 'x' }]),
      { groupBy: mockGroupBy, orderBy: mockOrderBy },
    ))

    const result = await getLeaderboard()

    expect(result.map(r => r.tournamentMaxPoints)).toEqual([10, 10])
    expect(result.find(r => r.userId === 'user-1')?.tournamentSuccessRate).toBe(60)
    expect(result.find(r => r.userId === 'user-2')?.tournamentSuccessRate).toBe(30)
  })

  it('tournament max sums partial slices of tournament-tip types (regression: 60/6 → 60/100)', async () => {
    mockOrderBy.mockResolvedValueOnce([ROW({ userId: 'user-1', totalPoints: 0 })])
    mockOrderBy.mockResolvedValueOnce([])
    mockGroupBy.mockImplementation(() => Object.assign(Promise.resolve([
      { userId: 'user-1', tournamentPoints: 60 },
    ]), { orderBy: mockOrderBy }))

    // Same shape the seeded rows have in production: `points = 0`, real max
    // comes from the correctAnswer JSON. 12 fully-populated groups → 36p,
    // last_32 with 32 team slots → 64p. Total 100p, user has 60 → 60%.
    const codes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    const allGroupsPayload = {
      groups: Object.fromEntries(codes.map(c => [c, [`${c}1`, `${c}2`, `${c}3`, `${c}4`]])),
      best3rds: [],
    }
    const bracketPayload = {
      participants: {
        last_32: Array.from({ length: 32 }, (_, i) => `t${i}`),
        last_16: [], qf: [], sf: [], final: [],
      },
      champion: null,
      bronzeWinner: null,
    }
    mockWhere.mockImplementation(() => Object.assign(Promise.resolve([
      {
        inputType: 'all_groups_standing',
        options: { groups: codes, teamsPerGroup: 4, best3rdPicks: 0 },
        points: 0,
        correctAnswer: JSON.stringify(allGroupsPayload),
      },
      {
        inputType: 'bracket_progression',
        options: null,
        points: 0,
        correctAnswer: JSON.stringify(bracketPayload),
      },
    ]), { groupBy: mockGroupBy, orderBy: mockOrderBy }))

    const result = await getLeaderboard()

    expect(result[0].specialPredictionPoints).toBe(60)
    expect(result[0].tournamentMaxPoints).toBe(100)
    expect(result[0].tournamentSuccessRate).toBe(60)
  })
})
