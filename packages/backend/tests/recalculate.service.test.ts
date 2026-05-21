import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const scoringMocks = vi.hoisted(() => ({
  calculateAndSavePoints: vi.fn().mockResolvedValue(undefined),
  calculateAndSaveGroupPoints: vi.fn().mockResolvedValue(undefined),
}))

const stateMocks = vi.hoisted(() => ({
  markRecalcStarted: vi.fn(),
  markRecalcFinished: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))
vi.mock('../src/services/scoring.service.js', () => scoringMocks)
vi.mock('../src/services/sync-state.service.js', () => stateMocks)

import { recalculateAll, startRecalculation } from '../src/services/recalculate.service.js'

function mockMatchResults(rows: Array<{ matchId: string; homeGoals: number; awayGoals: number; outcomeAfterDraw?: string | null }>): void {
  // Drizzle: db.select(...).from(matchResults) returns array directly when no .where
  const fromMock = vi.fn().mockResolvedValue(rows)
  mockDb.select.mockReturnValueOnce({ from: fromMock })
}

function mockPredictionsForMatch(predictions: Array<{ id: string; userId?: string }>): void {
  const where = vi.fn().mockResolvedValue(predictions)
  const from = vi.fn().mockReturnValue({ where })
  mockDb.select.mockReturnValueOnce({ from })
}

describe('recalculate.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    mockDb.update.mockReturnValue({ set: updateSet })
  })

  describe('recalculateAll', () => {
    it('returns zero counts when no match results exist', async () => {
      mockMatchResults([])

      const result = await recalculateAll()

      expect(result.matchesRecalculated).toBe(0)
      expect(result.predictionsUpdated).toBe(0)
      expect(result.groupId).toBeNull()
      expect(scoringMocks.calculateAndSavePoints).not.toHaveBeenCalled()
    })

    it('iterates all match results and calls scoring globally', async () => {
      mockMatchResults([
        { matchId: 'm1', homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null },
        { matchId: 'm2', homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null },
      ])
      mockPredictionsForMatch([{ id: 'p1' }, { id: 'p2' }])
      mockPredictionsForMatch([{ id: 'p3' }])

      const result = await recalculateAll()

      expect(result.matchesRecalculated).toBe(2)
      expect(result.predictionsUpdated).toBe(3)
      expect(scoringMocks.calculateAndSavePoints).toHaveBeenCalledTimes(2)
      expect(scoringMocks.calculateAndSaveGroupPoints).toHaveBeenCalledTimes(2)
      expect(mockDb.update).toHaveBeenCalledTimes(2)
    })

    it('skips global scoring when groupId provided (only group recalc)', async () => {
      mockMatchResults([{ matchId: 'm1', homeGoals: 1, awayGoals: 0, outcomeAfterDraw: null }])
      // group members select
      mockPredictionsForMatch([{ userId: 'u1' }])
      // match predictions select
      mockPredictionsForMatch([{ id: 'p1', userId: 'u1' }, { id: 'p2', userId: 'u2' }])
      const deleteWhere = vi.fn().mockResolvedValue(undefined)
      mockDb.delete.mockReturnValue({ where: deleteWhere })

      const result = await recalculateAll({ groupId: 'g1' })

      expect(result.matchesRecalculated).toBe(1)
      expect(result.groupId).toBe('g1')
      expect(scoringMocks.calculateAndSavePoints).not.toHaveBeenCalled()
      expect(scoringMocks.calculateAndSaveGroupPoints).toHaveBeenCalledOnce()
    })
  })

  describe('startRecalculation', () => {
    it('returns false when lock cannot be acquired', async () => {
      stateMocks.markRecalcStarted.mockResolvedValueOnce(false)

      const acquired = await startRecalculation()
      expect(acquired).toBe(false)
      expect(stateMocks.markRecalcFinished).not.toHaveBeenCalled()
    })

    it('returns true and runs recalc in background when lock acquired', async () => {
      stateMocks.markRecalcStarted.mockResolvedValueOnce(true)
      mockMatchResults([])

      const acquired = await startRecalculation()
      expect(acquired).toBe(true)

      // wait for the fire-and-forget promise to resolve
      await new Promise(r => setImmediate(r))

      expect(stateMocks.markRecalcFinished).toHaveBeenCalledOnce()
    })

    it('reports error result when recalc throws', async () => {
      stateMocks.markRecalcStarted.mockResolvedValueOnce(true)
      // make select throw
      mockDb.select.mockImplementationOnce(() => { throw new Error('boom') })

      await startRecalculation()
      await new Promise(r => setImmediate(r))

      const lastCall = stateMocks.markRecalcFinished.mock.calls[0]?.[0]
      expect(lastCall?.error).toBe('boom')
    })
  })
})
