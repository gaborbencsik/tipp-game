import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))

vi.mock('../src/db/schema/index.js', () => ({
  syncState: { id: 'id', mode: 'mode', lastSuccessfulSyncAt: 'last_successful_sync_at', apiCallsToday: 'api_calls_today', apiCallsDate: 'api_calls_date', syncInProgress: 'sync_in_progress', recalcInProgress: 'recalc_in_progress', lastRecalcResult: 'last_recalc_result', updatedAt: 'updated_at' },
  matches: { id: 'id', status: 'status' },
}))

import {
  getSyncState,
  setSyncMode,
  markSyncStarted,
  markSyncFinished,
  hasLiveMatch,
  markPolymarketSyncFinished,
  markRecalcStarted,
  markRecalcFinished,
  getRecalcStatus,
} from '../src/services/sync-state.service.js'

describe('sync-state.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSyncState', () => {
    it('returns default state when no row exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      const state = await getSyncState()

      expect(state).toEqual({
        mode: 'off',
        lastSuccessfulSyncAt: null,
        apiCallsToday: 0,
        apiCallsDate: null,
        syncInProgress: false,
        polymarketSyncEnabled: false,
        lastPolymarketSyncAt: null,
        playerSyncEnabled: false,
        lastPlayerSyncAt: null,
        transfermarktSyncEnabled: false,
        lastTransfermarktSyncAt: null,
        rawStatsSyncEnabled: false,
        lastRawStatsSyncAt: null,
        rawStatsSkipFresh: false,
        recalcInProgress: false,
        lastRecalcResult: null,
        insightsSyncEnabled: false,
        lastInsightsSyncAt: null,
      })
    })

    it('returns stored state when row exists', async () => {
      const row = {
        id: 'uuid-1',
        mode: 'adaptive',
        lastSuccessfulSyncAt: new Date('2026-06-15T10:00:00Z'),
        apiCallsToday: 42,
        apiCallsDate: '2026-06-15',
        syncInProgress: false,
        polymarketSyncEnabled: true,
        playerSyncEnabled: false,
        lastPlayerSyncAt: null,
        transfermarktSyncEnabled: false,
        lastTransfermarktSyncAt: null,
        updatedAt: new Date(),
      }
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([row]),
        }),
      })

      const state = await getSyncState()

      expect(state.mode).toBe('adaptive')
      expect(state.apiCallsToday).toBe(42)
      expect(state.lastSuccessfulSyncAt).toEqual(new Date('2026-06-15T10:00:00Z'))
    })
  })

  describe('setSyncMode', () => {
    it('inserts a new row when none exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })

      await setSyncMode('adaptive')

      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('updates existing row when one exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'uuid-1' }]),
        }),
      })
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      await setSyncMode('full_live')

      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('markSyncStarted', () => {
    it('returns true when sync_in_progress was false', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'uuid-1' }]),
          }),
        }),
      })

      const claimed = await markSyncStarted()
      expect(claimed).toBe(true)
    })

    it('returns false when no row was updated (already in progress)', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const claimed = await markSyncStarted()
      expect(claimed).toBe(false)
    })
  })

  describe('markSyncFinished', () => {
    it('resets sync_in_progress and sets last_successful_sync_at on success', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      })

      await markSyncFinished(true)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('markPolymarketSyncFinished', () => {
    it('updates last_polymarket_sync_at when row exists', async () => {
      const setSpy = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'uuid-1' }]),
        }),
      })
      mockDb.update.mockReturnValue({ set: setSpy })

      await markPolymarketSyncFinished()

      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
        lastPolymarketSyncAt: expect.anything(),
      }))
    })

    it('is a no-op when no row exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      await markPolymarketSyncFinished()

      expect(mockDb.update).not.toHaveBeenCalled()
    })
  })

  describe('hasLiveMatch', () => {
    it('returns true when a live match exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'match-1' }]),
          }),
        }),
      })

      expect(await hasLiveMatch()).toBe(true)
    })

    it('returns false when no live match exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      expect(await hasLiveMatch()).toBe(false)
    })
  })

  describe('markRecalcStarted', () => {
    it('returns true when recalc and sync are both idle', async () => {
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'uuid-1' }]),
          }),
        }),
      })

      expect(await markRecalcStarted()).toBe(true)
    })

    it('returns false when sync is in progress', async () => {
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      expect(await markRecalcStarted()).toBe(false)
    })
  })

  describe('markRecalcFinished', () => {
    it('clears recalc_in_progress and stores last_recalc_result', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'uuid-1' }]),
        }),
      })
      const setSpy = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
      mockDb.update.mockReturnValue({ set: setSpy })

      const result = {
        matchesRecalculated: 5,
        predictionsUpdated: 25,
        durationMs: 1234,
        groupId: null,
        finishedAt: '2026-06-15T10:00:00Z',
      }

      await markRecalcFinished(result)

      expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
        recalcInProgress: false,
        lastRecalcResult: result,
      }))
    })
  })

  describe('getRecalcStatus', () => {
    it('returns idle when no row exists', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      })

      expect(await getRecalcStatus()).toEqual({ status: 'idle', lastResult: null })
    })

    it('returns running when recalc_in_progress is true', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ recalcInProgress: true, lastRecalcResult: null }]),
        }),
      })

      expect(await getRecalcStatus()).toEqual({ status: 'running', lastResult: null })
    })

    it('returns idle with last result when recalc finished', async () => {
      const lastResult = {
        matchesRecalculated: 3,
        predictionsUpdated: 12,
        durationMs: 500,
        groupId: null,
        finishedAt: '2026-06-15T10:00:00Z',
      }
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ recalcInProgress: false, lastRecalcResult: lastResult }]),
        }),
      })

      expect(await getRecalcStatus()).toEqual({ status: 'idle', lastResult })
    })
  })
})
