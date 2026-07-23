import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
  mockInsert, mockInsertValues, mockOnConflict,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn().mockResolvedValue([])
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockWhere = vi.fn(() => ({ limit: mockLimit }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  const mockOnConflict = vi.fn().mockResolvedValue([])
  const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }))
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

  return {
    mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
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
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
  isGlobalDefault: true,
}

const PREDICTIONS = [
  { id: 'pred-1', userId: 'user-1', matchId: MATCH_ID, homeGoals: 2, awayGoals: 1 }, // exact → 2 (1+1)
  { id: 'pred-2', userId: 'user-2', matchId: MATCH_ID, homeGoals: 3, awayGoals: 1 }, // correct winner → 1
  { id: 'pred-3', userId: 'user-3', matchId: MATCH_ID, homeGoals: 0, awayGoals: 1 }, // wrong → 0
]

const GROUP_CONFIG_ROW = {
  id: 'group-config-1',
  correctOutcomePoints: 2,
  exactBonusPoints: 3,
  extraTimeBonusPoints: 1,
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

  function setupSelectChain(predictionsRows: unknown[], configRows: unknown[], scorerRows: unknown[] = []) {
    // Three parallel selects: predictions, configs, matchResults.scorerPlayerIds
    // Predictions: select().from().where()
    const mockPredWhere = vi.fn().mockResolvedValue(predictionsRows)
    const mockPredFrom = vi.fn().mockReturnValue({ where: mockPredWhere })
    // Configs: select().from().where()
    const mockConfWhere = vi.fn().mockResolvedValue(configRows)
    const mockConfFrom = vi.fn().mockReturnValue({ where: mockConfWhere })
    // Scorer: select().from().where().limit(1)
    const mockScorerLimit = vi.fn().mockResolvedValue(scorerRows)
    const mockScorerWhere = vi.fn().mockReturnValue({ limit: mockScorerLimit })
    const mockScorerFrom = vi.fn().mockReturnValue({ where: mockScorerWhere })
    mockSelect
      .mockReturnValueOnce({ from: mockPredFrom })
      .mockReturnValueOnce({ from: mockConfFrom })
      .mockReturnValueOnce({ from: mockScorerFrom })
  }

  it('fetches predictions and global config, then updates each prediction', async () => {
    setupSelectChain(PREDICTIONS, [DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    expect(mockUpdate).toHaveBeenCalledTimes(3)
  })

  it('calculates correct points per prediction', async () => {
    setupSelectChain(PREDICTIONS, [DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    const setCalls = mockSet.mock.calls.map(c => (c[0] as { pointsGlobal: number }).pointsGlobal)
    expect(setCalls).toEqual(expect.arrayContaining([2, 1, 0]))
  })

  it('is idempotent — runs twice without error', async () => {
    setupSelectChain(PREDICTIONS, [DEFAULT_CONFIG_ROW])
    await calculateAndSavePoints(MATCH_ID, RESULT)

    setupSelectChain(PREDICTIONS, [DEFAULT_CONFIG_ROW])
    await calculateAndSavePoints(MATCH_ID, RESULT)

    expect(mockUpdate).toHaveBeenCalledTimes(6)
  })

  it('no predictions → no updates', async () => {
    setupSelectChain([], [DEFAULT_CONFIG_ROW])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('no global config → throws', async () => {
    setupSelectChain(PREDICTIONS, [])

    await expect(calculateAndSavePoints(MATCH_ID, RESULT)).rejects.toThrow('No global scoring config found')
  })

  it('SCORER-003: scorer pick + match goal → +1 added to points_global, scorer_bonus_points=1', async () => {
    const PREDS = [
      { id: 'pred-1', userId: 'u1', matchId: MATCH_ID, homeGoals: 2, awayGoals: 1, scorerPickPlayerId: 'player-x' },
    ]
    setupSelectChain(PREDS, [DEFAULT_CONFIG_ROW], [{ scorerPlayerIds: ['player-x'] }])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    const args = mockSet.mock.calls[0]?.[0] as { pointsGlobal: number; scorerBonusPoints: number }
    expect(args.pointsGlobal).toBe(3)        // exact (2) + scorer (1)
    expect(args.scorerBonusPoints).toBe(1)
  })

  it('SCORER-003: scorer pick miss → scorer_bonus_points=0, points_global unchanged', async () => {
    const PREDS = [
      { id: 'pred-1', userId: 'u1', matchId: MATCH_ID, homeGoals: 2, awayGoals: 1, scorerPickPlayerId: 'player-x' },
    ]
    setupSelectChain(PREDS, [DEFAULT_CONFIG_ROW], [{ scorerPlayerIds: ['player-y'] }])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    const args = mockSet.mock.calls[0]?.[0] as { pointsGlobal: number; scorerBonusPoints: number }
    expect(args.pointsGlobal).toBe(2)
    expect(args.scorerBonusPoints).toBe(0)
  })

  it('SCORER-003: no scorer pick → scorer_bonus_points=0', async () => {
    const PREDS = [
      { id: 'pred-1', userId: 'u1', matchId: MATCH_ID, homeGoals: 2, awayGoals: 1, scorerPickPlayerId: null },
    ]
    setupSelectChain(PREDS, [DEFAULT_CONFIG_ROW], [{ scorerPlayerIds: ['player-x'] }])

    await calculateAndSavePoints(MATCH_ID, RESULT)

    const args = mockSet.mock.calls[0]?.[0] as { pointsGlobal: number; scorerBonusPoints: number }
    expect(args.scorerBonusPoints).toBe(0)
  })
})

describe('calculateAndSaveGroupPoints', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockOnConflict.mockResolvedValue([])
    mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict })
    mockInsert.mockReturnValue({ values: mockInsertValues })
  })

  function setupParallelSelect(predictions: unknown[], matchRow: unknown, scorerRows: unknown[] = []) {
    // The function does Promise.all([selectPredictions, selectMatch, selectScorerIds])
    // First call to select → predictions chain
    const mockPredWhere = vi.fn().mockResolvedValue(predictions)
    const mockPredFrom = vi.fn().mockReturnValue({ where: mockPredWhere })

    // Second call to select → match chain (needs .from().where().limit())
    const mockMatchLimit = vi.fn().mockResolvedValue(matchRow ? [matchRow] : [])
    const mockMatchWhere = vi.fn().mockReturnValue({ limit: mockMatchLimit })
    const mockMatchFrom = vi.fn().mockReturnValue({ where: mockMatchWhere })

    // Third call → match_results scorer ids (.from().where().limit())
    const mockScorerLimit = vi.fn().mockResolvedValue(scorerRows)
    const mockScorerWhere = vi.fn().mockReturnValue({ limit: mockScorerLimit })
    const mockScorerFrom = vi.fn().mockReturnValue({ where: mockScorerWhere })

    mockSelect
      .mockReturnValueOnce({ from: mockPredFrom })
      .mockReturnValueOnce({ from: mockMatchFrom })
      .mockReturnValueOnce({ from: mockScorerFrom })
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

  function setupGroupLeaguesSelect(rows: Array<{ groupId: string; leagueId: string }> = []) {
    const mockGLFrom = vi.fn().mockResolvedValue(rows)
    mockSelect.mockReturnValueOnce({ from: mockGLFrom })
  }

  function setupGroupMatchesSelect(rows: Array<{ groupId: string }> = []) {
    const mockGMWhere = vi.fn().mockResolvedValue(rows)
    const mockGMFrom = vi.fn().mockReturnValue({ where: mockGMWhere })
    mockSelect.mockReturnValueOnce({ from: mockGMFrom })
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
    setupGroupLeaguesSelect([])
    setupGroupMatchesSelect([])

    // User's groups query
    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: 'cfg-1', favoriteTeamDoublePoints: false, config: GROUP_CONFIG_ROW },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.groupId).toBe('group-uuid-1')
    expect(insertedValues.points).toBe(5) // exact 2-1 with GROUP cfg: outcome(2) + exact(3) = 5
  })

  it('no groups with config or doublePoints → no inserts', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)
    setupGroupLeaguesSelect([])
    setupGroupMatchesSelect([])
    setupUserGroupsSelect([])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('favorite team double points → ×2 when fav team plays', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-home' }])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)
    setupGroupLeaguesSelect([])
    setupGroupMatchesSelect([])

    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: null, favoriteTeamDoublePoints: true, config: null },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.points).toBe(4) // exact 2-1 default cfg: 2 × 2 (fav)
  })

  it('favorite team double points → ×1 when fav team does NOT play', async () => {
    setupParallelSelect([PREDICTIONS[0]], MATCH_ROW)
    setupFavoritesSelect([{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-other' }])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)
    setupGroupLeaguesSelect([])
    setupGroupMatchesSelect([])

    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: null, favoriteTeamDoublePoints: true, config: null },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.points).toBe(2) // exact 2-1 default cfg: 2 × 1 (fav not playing)
  })

  // ─── US-953: hand-picked matches bypass the league gate ─────────────────────

  it('US-953: match outside the group leagues is SKIPPED without a hand-pick', async () => {
    // Match belongs to league-OTHER; group only subscribes to league-1 and did
    // not hand-pick the match → league gate excludes it.
    setupParallelSelect([PREDICTIONS[0]], { homeTeamId: 'team-home', awayTeamId: 'team-away', leagueId: 'league-OTHER' })
    setupFavoritesSelect([])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)
    setupGroupLeaguesSelect([{ groupId: 'group-uuid-1', leagueId: 'league-1' }])
    setupGroupMatchesSelect([]) // not hand-picked
    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: 'cfg-1', favoriteTeamDoublePoints: false, config: GROUP_CONFIG_ROW },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('US-953: hand-picked match outside the group leagues STILL gets group points', async () => {
    setupParallelSelect([PREDICTIONS[0]], { homeTeamId: 'team-home', awayTeamId: 'team-away', leagueId: 'league-OTHER' })
    setupFavoritesSelect([])
    setupGlobalConfigSelect(DEFAULT_CONFIG_ROW)
    setupGroupLeaguesSelect([{ groupId: 'group-uuid-1', leagueId: 'league-1' }])
    setupGroupMatchesSelect([{ groupId: 'group-uuid-1' }]) // hand-picked → bypass gate
    setupUserGroupsSelect([
      { groupId: 'group-uuid-1', scoringConfigId: 'cfg-1', favoriteTeamDoublePoints: false, config: GROUP_CONFIG_ROW },
    ])

    await calculateAndSaveGroupPoints(MATCH_ID, RESULT)

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const insertedValues = mockInsertValues.mock.calls[0]![0] as { groupId: string; points: number }
    expect(insertedValues.groupId).toBe('group-uuid-1')
    expect(insertedValues.points).toBe(5)
  })
})
