import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { insert: mockInsert, select: mockSelect },
}))

import {
  recordUsage,
  getDailyStats,
  getLast7Days,
} from '../src/services/insights/usage.repository.js'

describe('usage.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('recordUsage', () => {
    it('inserts row with provider/model/tokens/success', async () => {
      const insertValues = vi.fn().mockResolvedValue(undefined)
      mockInsert.mockReturnValue({ values: insertValues })

      await recordUsage({
        provider: 'gemini',
        model: 'gemini-flash-latest',
        matchId: 'match-1',
        inputTokens: 553,
        outputTokens: 480,
        latencyMs: 1234,
        success: true,
        errorCode: null,
      })

      expect(insertValues).toHaveBeenCalledWith({
        provider: 'gemini',
        model: 'gemini-flash-latest',
        matchId: 'match-1',
        inputTokens: 553,
        outputTokens: 480,
        latencyMs: 1234,
        success: true,
        errorCode: null,
      })
    })

    it('inserts failure row with errorCode and zero tokens', async () => {
      const insertValues = vi.fn().mockResolvedValue(undefined)
      mockInsert.mockReturnValue({ values: insertValues })

      await recordUsage({
        provider: 'gemini',
        model: 'gemini-flash-latest',
        matchId: null,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 200,
        success: false,
        errorCode: 'INVALID_JSON',
      })

      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        errorCode: 'INVALID_JSON',
        matchId: null,
      }))
    })
  })

  describe('getDailyStats', () => {
    it('returns aggregated counts for given date', async () => {
      vi.setSystemTime(new Date('2026-05-25T12:00:00.000Z'))
      const sumRow = [{ requests: 42, inputTokens: 12000, outputTokens: 8000, translateRequests: 10 }]
      const where = vi.fn().mockResolvedValue(sumRow)
      const from = vi.fn().mockReturnValue({ where })
      mockSelect.mockReturnValue({ from })

      const stats = await getDailyStats(new Date('2026-05-25T00:00:00.000Z'))

      expect(stats).toEqual({
        date: '2026-05-25',
        requests: 42,
        inputTokens: 12000,
        outputTokens: 8000,
        generateRequests: 32,
        translateRequests: 10,
      })
    })

    it('returns zeros when no rows', async () => {
      const where = vi.fn().mockResolvedValue([{ requests: 0, inputTokens: 0, outputTokens: 0, translateRequests: 0 }])
      const from = vi.fn().mockReturnValue({ where })
      mockSelect.mockReturnValue({ from })

      const stats = await getDailyStats(new Date('2026-05-25T00:00:00.000Z'))
      expect(stats.requests).toBe(0)
    })
  })

  describe('getLast7Days', () => {
    it('returns array of last 7 days with date+requests+tokens', async () => {
      const rows = [
        { date: '2026-05-25', requests: 10, tokens: 5000 },
        { date: '2026-05-24', requests: 5, tokens: 2500 },
      ]
      const orderBy = vi.fn().mockResolvedValue(rows)
      const groupBy = vi.fn().mockReturnValue({ orderBy })
      const where = vi.fn().mockReturnValue({ groupBy })
      const from = vi.fn().mockReturnValue({ where })
      mockSelect.mockReturnValue({ from })

      const result = await getLast7Days()
      expect(result).toEqual(rows)
    })
  })
})
