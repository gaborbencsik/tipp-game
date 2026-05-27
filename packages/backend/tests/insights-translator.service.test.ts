import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockUpdate, mockTranslate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockTranslate: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, update: mockUpdate },
}))

vi.mock('../src/services/insights/llm.client.js', () => ({
  createLlmClient: () => ({ translate: mockTranslate }),
  LlmClientError: class LlmClientError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message)
      this.name = 'LlmClientError'
    }
  },
  LlmDailyLimitExceededError: class LlmDailyLimitExceededError extends Error {},
}))

import {
  translateInsight,
  translateInsightsForMatch,
  InsightTranslationError,
} from '../src/services/insights/translator.service.js'

interface InsightRow {
  id: string
  matchId: string
  type: string
  data: { title: string; body: string; dataPoints?: Record<string, number> }
  titleHu: string | null
  bodyHu: string | null
  translatedAt: Date | null
}

function mockSelectInsights(rows: InsightRow[]) {
  mockSelect.mockImplementation(() => ({
    from: () => ({
      where: () => Promise.resolve(rows),
    }),
  }))
}

function makeUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined)
  const set = vi.fn().mockReturnValue({ where })
  mockUpdate.mockReturnValue({ set })
  return { set, where }
}

describe('translator.service', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockUpdate.mockReset()
    mockTranslate.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T12:00:00.000Z'))
  })

  describe('translateInsight', () => {
    it('translates a single insight and writes title_hu/body_hu/translated_at', async () => {
      const insight: InsightRow = {
        id: 'insight-1', matchId: 'match-1', type: 'defense',
        data: { title: 'Strong defense', body: 'Conceded 0.73/match.' },
        titleHu: null, bodyHu: null, translatedAt: null,
      }
      mockSelectInsights([insight])
      const { set } = makeUpdateChain()
      mockTranslate.mockResolvedValue({ titleHu: 'Erős védelem', bodyHu: 'Mérkőzésenként 0.73 gólt kaptak.' })

      await translateInsight('insight-1')

      expect(mockTranslate).toHaveBeenCalledTimes(1)
      const callArg = mockTranslate.mock.calls[0]![0]
      expect(callArg.prompt).toContain('Strong defense')
      expect(callArg.matchId).toBe('match-1')
      expect(set).toHaveBeenCalledWith(expect.objectContaining({
        titleHu: 'Erős védelem',
        bodyHu: 'Mérkőzésenként 0.73 gólt kaptak.',
        translatedAt: expect.any(Date),
      }))
    })

    it('throws InsightTranslationError when insight does not exist', async () => {
      mockSelectInsights([])
      await expect(translateInsight('missing')).rejects.toBeInstanceOf(InsightTranslationError)
      expect(mockTranslate).not.toHaveBeenCalled()
    })

    it('retries once on LlmClientError, then throws InsightTranslationError', async () => {
      mockSelectInsights([{
        id: 'i1', matchId: 'm1', type: 'attack',
        data: { title: 'T', body: 'B' },
        titleHu: null, bodyHu: null, translatedAt: null,
      }])
      makeUpdateChain()
      const { LlmClientError } = await import('../src/services/insights/llm.client.js')
      mockTranslate
        .mockRejectedValueOnce(new LlmClientError('bad', 'INVALID_JSON'))
        .mockRejectedValueOnce(new LlmClientError('bad', 'INVALID_JSON'))

      await expect(translateInsight('i1')).rejects.toBeInstanceOf(InsightTranslationError)
      expect(mockTranslate).toHaveBeenCalledTimes(2)
    })

    it('retry succeeds after one failure', async () => {
      mockSelectInsights([{
        id: 'i1', matchId: 'm1', type: 'attack',
        data: { title: 'T', body: 'B' },
        titleHu: null, bodyHu: null, translatedAt: null,
      }])
      const { set } = makeUpdateChain()
      const { LlmClientError } = await import('../src/services/insights/llm.client.js')
      mockTranslate
        .mockRejectedValueOnce(new LlmClientError('bad', 'INVALID_JSON'))
        .mockResolvedValueOnce({ titleHu: 'C', bodyHu: 'D' })

      await translateInsight('i1')

      expect(mockTranslate).toHaveBeenCalledTimes(2)
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ titleHu: 'C', bodyHu: 'D' }))
    })
  })

  describe('translateInsightsForMatch', () => {
    it('translates each insight that is not yet translated or stale', async () => {
      const fresh = new Date('2026-05-24T12:00:00.000Z') // < 7d old
      const stale = new Date('2026-05-10T12:00:00.000Z') // > 7d old
      mockSelectInsights([
        { id: 'i1', matchId: 'm1', type: 'defense', data: { title: 'T1', body: 'B1' }, titleHu: null, bodyHu: null, translatedAt: null },
        { id: 'i2', matchId: 'm1', type: 'attack', data: { title: 'T2', body: 'B2' }, titleHu: 'X', bodyHu: 'Y', translatedAt: fresh },
        { id: 'i3', matchId: 'm1', type: 'form', data: { title: 'T3', body: 'B3' }, titleHu: 'X', bodyHu: 'Y', translatedAt: stale },
      ])
      makeUpdateChain()
      mockTranslate.mockResolvedValue({ titleHu: 'HU', bodyHu: 'BO' })

      await translateInsightsForMatch('m1')

      // i1 (no translation) + i3 (stale) = 2 translations; i2 skipped
      expect(mockTranslate).toHaveBeenCalledTimes(2)
    })

    it('skips raw_stats type rows', async () => {
      mockSelectInsights([
        { id: 'raw', matchId: 'm1', type: 'raw_stats', data: { title: '', body: '' }, titleHu: null, bodyHu: null, translatedAt: null },
        { id: 'i1', matchId: 'm1', type: 'defense', data: { title: 'T1', body: 'B1' }, titleHu: null, bodyHu: null, translatedAt: null },
      ])
      makeUpdateChain()
      mockTranslate.mockResolvedValue({ titleHu: 'HU', bodyHu: 'BO' })

      await translateInsightsForMatch('m1')

      expect(mockTranslate).toHaveBeenCalledTimes(1)
    })

    it('one insight failing does not block siblings', async () => {
      mockSelectInsights([
        { id: 'i1', matchId: 'm1', type: 'defense', data: { title: 'T1', body: 'B1' }, titleHu: null, bodyHu: null, translatedAt: null },
        { id: 'i2', matchId: 'm1', type: 'attack', data: { title: 'T2', body: 'B2' }, titleHu: null, bodyHu: null, translatedAt: null },
      ])
      makeUpdateChain()
      const { LlmClientError } = await import('../src/services/insights/llm.client.js')
      mockTranslate
        .mockRejectedValueOnce(new LlmClientError('bad', 'INVALID_JSON'))
        .mockRejectedValueOnce(new LlmClientError('bad', 'INVALID_JSON'))
        .mockResolvedValueOnce({ titleHu: 'C', bodyHu: 'D' })

      const result = await translateInsightsForMatch('m1')

      expect(result.translated).toBe(1)
      expect(result.errors.length).toBe(1)
    })
  })
})
