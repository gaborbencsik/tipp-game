import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockFrom, mockWhere, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
  mockInsert, mockInsertValues, mockOnConflict,
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

  return {
    mockSelect, mockFrom, mockWhere, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
    mockInsert, mockInsertValues, mockOnConflict,
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

  function setupParallelSelect(predictions: unknown[], matchRow: unknown) {
    // The function does Promise.all([selectPredictions, selectMatch])
    // First call to select → predictions chain
    const mockPredWhere = vi.fn().mockResolvedValue(predictions)
    const mockPredFrom = vi.fn().mockReturnValue({ where: mockPredWhere })

    // Second call to select → match chain (needs .from().where().limit())
    const mockMatchLimit = vi.fn().mockResolvedValue(matchRow ? [matchRow] : [])
    const mockMatchWhere = vi.fn().mockReturnValue({ limit: mockMatchLimit })
    const mockMatchFrom = vi.fn().mockReturnValue({ where: mockMatchWhere })

    mockSelect
      .mockReturnValueOnce({ from: mockPredFrom })
      .mockReturnValueOnce({ from: mockMatchFrom })
  }

  function setupFavoritesSelect(favorites: unknown[]) {
    const mockFavWhere = vi.fn().mockResolvedValue(favorites)
    const mockFavFrom = vi.fn().mockReturnValue({ where: mockFavWhere })
    mockSelect.mockReturnValueOnce({ from: mockFavFrom })
  }

  function setupGlobalConfigSelect(config: unknown) {
    const mockConfigWhere = vi.fn().mockResolvedValue(config ? [config] : [])
    const mockConfigFrom = vi.fn().mockReturnValue({ where: mockConfigWhere })
    mockSelect.mockReturnValueOnce({ from: mockConfigFrom })
  }

  function setupUserGroupsSelect(groups: unknown[]) {
    const mockGroupWhere = vi.fn().mockResolvedValue(groups)
    const mockLeftJoin = vi.fn().mockReturnValue({ where: mockGroupWhere })
    const mockInnerJoin = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin })
    const mockGroupFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin })
    mockSelect.mockReturnValueOnce({ from: mockGroupFrom })
  }

  const MATCH_ROW = { homeTeamId: 'team-home', awayTeamId: 'team-away', leagueId: 'league-1' }

  it('no predictions → no inserts', async () => {
    setupParallelSelect([], MATCH_ROW)

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('no match row → no inserts', async () => {
    setupParallelSelect([PREDICTIONS[0]], null)

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('inserts group points for predictions of users in groups with config', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)

    // User's groups query
    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: 'cfg-1', favoriteTeamDoublePoints: false, config: GROUP_CONFIG_ROW },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.groupId).toBe('group-uuid-1')
    expect(insertedValues.points).toBe(5) // exact score with GROUP_CONFIG_ROW.exactScore = 5
  })

  it('no groups with config or doublePoints → no inserts', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)
    setupUserGroupsSelect([])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('favorite team double points → ×2 when fav team plays', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-home' }])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)

    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: null, favoriteTeamDoublePoints: true, config: null },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.points).toBe(6) // exact(3) × 2
  })

  it('favorite team double points → ×1 when fav team does NOT play', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-other' }])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)

    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: null, favoriteTeamDoublePoints: true, config: null },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.points).toBe(3) // exact(3) × 1 (fav not playing)
  })
})
