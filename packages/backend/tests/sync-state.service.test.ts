import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))

vi.mock('../src/db/schema/index.js', () => ({
  syncState: { id: 'id', mode: 'mode', lastSuccessfulSyncAt: 'last_successful_sync_at', apiCallsToday: 'api_calls_today', apiCallsDate: 'api_calls_date', syncInProgress: 'sync_in_progress', updatedAt: 'updated_at' },
  matches: { id: 'id', status: 'status' },
}))

import {
  getSyncState,
  setSyncMode,
  markSyncStarted,
  markSyncFinished,
  hasLiveMatch,
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
})
