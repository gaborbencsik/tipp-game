import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockFrom, mockWhere, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
  mockInsert, mockInsertValues, mockOnConflict,
  mockInnerJoin2,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn().mockResolvedValue([])
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))
  const mockWhere = vi.fn()
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  const mockOnConflict = vi.fn().mockResolvedValue([])
  const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }))
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

  const mockInnerJoin2 = vi.fn()

  return {
    mockSelect, mockFrom, mockWhere, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
    mockInsert, mockInsertValues, mockOnConflict,
    mockInnerJoin2,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, update: mockUpdate, insert: mockInsert },
}))

import { calculateAndSavePoints, calculateAndSaveGroupPoints } from '../src/services/scoring.service.js'

const MATCH_ID = 'match-uuid-1'
const RESULT = { homeGoals: 2, awayGoals: 1 }

const DEFAULT_CONFIG_ROW = {
  id: 'config-1',
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
  isGlobalDefault: true,
}

const PREDICTIONS = [
  { id: 'pred-1', userId: 'user-1', matchId: MATCH_ID, homeGoals: 2, awayGoals: 1 }, // exact → 3
  { id: 'pred-2', userId: 'user-2', matchId: MATCH_ID, homeGoals: 3, awayGoals: 1 }, // correct winner → 1
  { id: 'pred-3', userId: 'user-3', matchId: MATCH_ID, homeGoals: 0, awayGoals: 1 }, // wrong → 0
]

const GROUP_CONFIG_ROW = {
  id: 'group-config-1',
  exactScore: 5,
  correctWinnerAndDiff: 3,
  correctWinner: 2,
  correctDraw: 3,
  correctOutcome: 1,
  incorrect: 0,
  isGlobalDefault: false,
}

describe('calculateAndSavePoints', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUpdateReturning.mockResolvedValue([{ id: 'pred-1' }])
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning })
    mockSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdate.mockReturnValue({ set: mockSet })
  })

  it('fetches predictions and global config, then updates each prediction', async () => {
    // First select: predictions
    // Second select: scoring config
    mockWhere
      .mockResolvedValueOnce(PREDICTIONS)
      .mockResolvedValueOnce([DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    expect(mockUpdate).toHaveBeenCalledTimes(3)
  })

  it('calculates correct points per prediction', async () => {
    mockWhere
      .mockResolvedValueOnce(PREDICTIONS)
      .mockResolvedValueOnce([DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    const setCalls = mockSet.mock.calls.map(c => (c[0] as { pointsGlobal: number }).pointsGlobal)
    expect(setCalls).toEqual(expect.arrayContaining([3, 1, 0]))
  })

  it('is idempotent — runs twice without error', async () => {
    mockWhere
      .mockResolvedValueOnce(PREDICTIONS)
      .mockResolvedValueOnce([DEFAULT_CONFIG_ROW])
      .mockResolvedValueOnce(PREDICTIONS)
      .mockResolvedValueOnce([DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)
    await calculateAndSavePoints(MATCH_ID, RESULT)

    expect(mockUpdate).toHaveBeenCalledTimes(6)
  })

  it('no predictions → no updates', async () => {
    mockWhere
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('no global config → throws', async () => {
    mockWhere
      .mockResolvedValueOnce(PREDICTIONS)
      .mockResolvedValueOnce([])

    await expect(calculateAndSavePoints(MATCH_ID, RESULT)).rejects.toThrow('No global scoring config found')
  })
})

describe('calculateAndSaveGroupPoints', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockOnConflict.mockResolvedValue([])
    mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict })
    mockInsert.mockReturnValue({ values: mockInsertValues })
  })

  it('no predictions → no inserts', async () => {
    mockWhere.mockResolvedValueOnce([])
    mockFrom.mockReturnValueOnce({ where: mockWhere })
    mockSelect.mockReturnValueOnce({ from: mockFrom })

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('inserts group points for predictions of users in groups with config', async () => {
    const singlePrediction = [PREDICTIONS[0]]

    // First select: predictions WHERE matchId
    const mockPredWhere = vi.fn().mockResolvedValue(singlePrediction)
    const mockPredFrom = vi.fn().mockReturnValue({ where: mockPredWhere })
    mockSelect.mockReturnValueOnce({ from: mockPredFrom })

    // Second select: groupsWithConfig for user-1
    const groupsWithConfigRows = [
      { groupId: 'group-uuid-1', config: GROUP_CONFIG_ROW },
    ]
    const mockGroupConfigWhere = vi.fn().mockResolvedValue(groupsWithConfigRows)
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 })
    mockInnerJoin2.mockReturnValue({ where: mockGroupConfigWhere })
    const mockGroupFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 })
    mockSelect.mockReturnValueOnce({ from: mockGroupFrom })

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.groupId).toBe('group-uuid-1')
    expect(insertedValues.points).toBe(5) // exact score with GROUP_CONFIG_ROW.exactScore = 5
  })

  it('no groups with config → no inserts', async () => {
    const singlePrediction = [PREDICTIONS[0]]

    // First select: predictions
    const mockPredWhere = vi.fn().mockResolvedValue(singlePrediction)
    const mockPredFrom = vi.fn().mockReturnValue({ where: mockPredWhere })
    mockSelect.mockReturnValueOnce({ from: mockPredFrom })

    // Second select: no groups with config
    const mockGroupConfigWhere = vi.fn().mockResolvedValue([])
    const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 })
    mockInnerJoin2.mockReturnValue({ where: mockGroupConfigWhere })
    const mockGroupFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 })
    mockSelect.mockReturnValueOnce({ from: mockGroupFrom })

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })
})
