import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))

import {
  upsertLiveState,
  getLiveStateByMatchId,
  deleteLiveState,
  finalizeLiveToResult,
} from '../src/services/live-match-state.service.js'

const NOW = new Date('2026-06-15T15:00:00Z')

describe('live-match-state.service', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('upsertLiveState', () => {
    it('inserts on conflict updates home/away/minute/apiStatus', async () => {
      const onConflictDoUpdate = vi.fn().mockReturnValue(Promise.resolve(undefined))
      const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
      mockDb.insert.mockReturnValue({ values })

      await upsertLiveState({
        matchId: 'm1', homeScore: 2, awayScore: 1, minute: 67, apiStatus: '2H',
      })

      expect(mockDb.insert).toHaveBeenCalledOnce()
      expect(values).toHaveBeenCalledWith({
        matchId: 'm1', homeScore: 2, awayScore: 1, minute: 67, apiStatus: '2H',
      })
      expect(onConflictDoUpdate).toHaveBeenCalled()
    })
  })

  describe('getLiveStateByMatchId', () => {
    it('returns null when no row exists', async () => {
      const where = vi.fn().mockResolvedValue([])
      const from = vi.fn().mockReturnValue({ where })
      mockDb.select.mockReturnValue({ from })

      const result = await getLiveStateByMatchId('m1')
      expect(result).toBeNull()
    })

    it('returns the row when present', async () => {
      const row = { matchId: 'm1', homeScore: 2, awayScore: 1, minute: 67, apiStatus: '2H', updatedAt: NOW }
      const where = vi.fn().mockResolvedValue([row])
      const from = vi.fn().mockReturnValue({ where })
      mockDb.select.mockReturnValue({ from })

      const result = await getLiveStateByMatchId('m1')
      expect(result).toEqual(row)
    })
  })

  describe('deleteLiveState', () => {
    it('deletes by matchId', async () => {
      const where = vi.fn().mockResolvedValue(undefined)
      mockDb.delete.mockReturnValue({ where })

      await deleteLiveState('m1')

      expect(mockDb.delete).toHaveBeenCalledOnce()
      expect(where).toHaveBeenCalled()
    })
  })

  describe('finalizeLiveToResult', () => {
    function buildTx(existingRow: unknown | null) {
      const txDelete = { where: vi.fn().mockResolvedValue(undefined) }
      const txInsertOnConflict = vi.fn().mockResolvedValue(undefined)
      const txInsertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: txInsertOnConflict })
      const txInsert = { values: txInsertValues }
      const txSelectLimit = vi.fn().mockResolvedValue(existingRow ? [existingRow] : [])
      const txSelectWhere = vi.fn().mockReturnValue({ limit: txSelectLimit })
      const txSelectFrom = vi.fn().mockReturnValue({ where: txSelectWhere })
      const txSelect = vi.fn().mockReturnValue({ from: txSelectFrom })
      const tx = {
        delete: vi.fn().mockReturnValue(txDelete),
        insert: vi.fn().mockReturnValue(txInsert),
        select: txSelect,
      }
      return { tx, txInsertValues }
    }

    it('returns wasInserted=true when no existing result', async () => {
      const { tx, txInsertValues } = buildTx(null)
      mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx))

      const result = await finalizeLiveToResult({
        matchId: 'm1', homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'home_pen',
      })

      expect(result).toEqual({ wasInserted: true, scoreChanged: false })
      expect(txInsertValues).toHaveBeenCalledWith(expect.objectContaining({
        matchId: 'm1', homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'home_pen',
      }))
    })

    it('returns scoreChanged=true when score differs from existing', async () => {
      const { tx } = buildTx({ homeGoals: 1, awayGoals: 0, outcomeAfterDraw: null })
      mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx))

      const result = await finalizeLiveToResult({
        matchId: 'm1', homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null,
      })

      expect(result).toEqual({ wasInserted: false, scoreChanged: true })
    })

    it('returns scoreChanged=false when score equals existing', async () => {
      const { tx } = buildTx({ homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null })
      mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx))

      const result = await finalizeLiveToResult({
        matchId: 'm1', homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null,
      })

      expect(result).toEqual({ wasInserted: false, scoreChanged: false })
    })

    it('returns scoreChanged=true when outcomeAfterDraw differs', async () => {
      const { tx } = buildTx({ homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'penalties_home' })
      mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx))

      const result = await finalizeLiveToResult({
        matchId: 'm1', homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'penalties_away',
      })

      expect(result).toEqual({ wasInserted: false, scoreChanged: true })
    })
  })
})
