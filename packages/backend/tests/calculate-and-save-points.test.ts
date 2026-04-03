import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockFrom, mockWhere, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn().mockResolvedValue([])
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))
  const mockWhere = vi.fn()
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockSelect, mockFrom, mockWhere, mockUpdate, mockSet, mockUpdateWhere, mockUpdateReturning }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, update: mockUpdate },
}))

import { calculateAndSavePoints } from '../src/services/scoring.service.js'

const MATCH_ID = 'match-uuid-1'
const RESULT = { homeGoals: 2, awayGoals: 1 }

const DEFAULT_CONFIG_ROW = {
  id: 'config-1',
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  incorrect: 0,
  isGlobalDefault: true,
}

const PREDICTIONS = [
  { id: 'pred-1', userId: 'user-1', matchId: MATCH_ID, homeGoals: 2, awayGoals: 1 }, // exact → 3
  { id: 'pred-2', userId: 'user-2', matchId: MATCH_ID, homeGoals: 3, awayGoals: 1 }, // correct winner → 1
  { id: 'pred-3', userId: 'user-3', matchId: MATCH_ID, homeGoals: 0, awayGoals: 1 }, // wrong → 0
]

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
