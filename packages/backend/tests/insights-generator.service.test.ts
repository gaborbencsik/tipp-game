import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockInsert, mockGenerate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockGenerate: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

vi.mock('../src/services/insights/llm.client.js', () => ({
  createLlmClient: () => ({ generateInsights: mockGenerate }),
  LlmClientError: class LlmClientError extends Error {
    constructor(message: string, public readonly code: string) {
      super(message)
      this.name = 'LlmClientError'
    }
  },
  LlmDailyLimitExceededError: class LlmDailyLimitExceededError extends Error {},
}))

import {
  generateInsightsForMatch,
  InsightGenerationError,
} from '../src/services/insights/generator.service.js'

const RAW_STATS = {
  homeTeam: {
    externalId: 25, totalMatches: 30, wins: 18, draws: 7, losses: 5, winRate: 0.6,
    goalsScored: 65, goalsScoredPerMatch: 2.17, goalsConceded: 22, goalsConcededPerMatch: 0.73,
    cleanSheets: 12, cleanSheetRate: 0.4, formString: 'WWDLW', recentMatches: [],
  },
  awayTeam: {
    externalId: 7, totalMatches: 28, wins: 16, draws: 6, losses: 6, winRate: 0.57,
    goalsScored: 50, goalsScoredPerMatch: 1.79, goalsConceded: 25, goalsConcededPerMatch: 0.89,
    cleanSheets: 9, cleanSheetRate: 0.32, formString: 'WLWDW', recentMatches: [],
  },
}

const FIVE_VALID_INSIGHTS = [
  { type: 'defense', title: 'Defensive solidity', body: 'b1.', dataPoints: { home_clean_sheets: 12 } },
  { type: 'attack', title: 'Offensive output', body: 'b2.', dataPoints: { away_goals: 50 } },
  { type: 'form', title: 'Recent form', body: 'b3.', dataPoints: { home_form: 4 } },
  { type: 'set_pieces', title: 'Set pieces', body: 'b4.', dataPoints: { home_corners: 5 } },
  { type: 'historical', title: 'H2H trend', body: 'b5.', dataPoints: { wins: 3 } },
]

function mockSelectChain(matchRow: { homeTeamName: string; awayTeamName: string } | null, insightRows: { type: string; data: unknown; generatedAt: Date }[]) {
  // First: select match teams (returns array)
  // Second: select existing insights (returns array)
  let callIdx = 0
  mockSelect.mockImplementation(() => {
    const idx = callIdx++
    if (idx === 0) {
      return {
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve(matchRow ? [matchRow] : []),
              }),
            }),
          }),
        }),
      }
    }
    return {
      from: () => ({
        where: () => Promise.resolve(insightRows),
      }),
    }
  })
}

describe('generator.service', () => {
  beforeEach(() => {
    mockSelect.mockReset()
    mockInsert.mockReset()
    mockGenerate.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T12:00:00.000Z'))
  })

  it('successful generation: 5 insights upserted to DB', async () => {
    mockSelectChain(
      { homeTeamName: 'Germany', awayTeamName: 'Spain' },
      [{ type: 'raw_stats', data: RAW_STATS, generatedAt: new Date('2026-05-25T10:00:00.000Z') }],
    )
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate })
    mockInsert.mockReturnValue({ values: insertValues })
    mockGenerate.mockResolvedValue(FIVE_VALID_INSIGHTS)

    await generateInsightsForMatch('match-1')

    expect(mockGenerate).toHaveBeenCalledTimes(1)
    expect(insertValues).toHaveBeenCalledTimes(5)
  })

  it('throws InsightGenerationError if no raw_stats available', async () => {
    mockSelectChain(
      { homeTeamName: 'Germany', awayTeamName: 'Spain' },
      [],
    )

    await expect(generateInsightsForMatch('match-1')).rejects.toBeInstanceOf(InsightGenerationError)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('skips types with generated_at < 24h', async () => {
    const fresh = new Date('2026-05-25T08:00:00.000Z')
    mockSelectChain(
      { homeTeamName: 'Germany', awayTeamName: 'Spain' },
      [
        { type: 'raw_stats', data: RAW_STATS, generatedAt: fresh },
        { type: 'defense', data: {}, generatedAt: fresh },
        { type: 'attack', data: {}, generatedAt: fresh },
      ],
    )
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate })
    mockInsert.mockReturnValue({ values: insertValues })
    mockGenerate.mockResolvedValue([
      { type: 'form', title: 't', body: 'b', dataPoints: {} },
      { type: 'set_pieces', title: 't', body: 'b', dataPoints: {} },
      { type: 'historical', title: 't', body: 'b', dataPoints: {} },
    ])

    await generateInsightsForMatch('match-1')

    expect(mockGenerate).toHaveBeenCalledTimes(1)
    const call = mockGenerate.mock.calls[0]![0]
    expect(call.prompt).toMatch(/exactly 3 insights/)
    expect(insertValues).toHaveBeenCalledTimes(3)
  })

  it('skips entirely if all types are fresh (idempotent)', async () => {
    const fresh = new Date('2026-05-25T08:00:00.000Z')
    mockSelectChain(
      { homeTeamName: 'Germany', awayTeamName: 'Spain' },
      [
        { type: 'raw_stats', data: RAW_STATS, generatedAt: fresh },
        { type: 'defense', data: {}, generatedAt: fresh },
        { type: 'attack', data: {}, generatedAt: fresh },
        { type: 'form', data: {}, generatedAt: fresh },
        { type: 'set_pieces', data: {}, generatedAt: fresh },
        { type: 'key_matchup', data: {}, generatedAt: fresh },
        { type: 'fatigue', data: {}, generatedAt: fresh },
        { type: 'historical', data: {}, generatedAt: fresh },
      ],
    )

    await generateInsightsForMatch('match-1')

    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('retries once on LlmClientError, throws InsightGenerationError after second failure', async () => {
    mockSelectChain(
      { homeTeamName: 'Germany', awayTeamName: 'Spain' },
      [{ type: 'raw_stats', data: RAW_STATS, generatedAt: new Date('2026-05-25T10:00:00.000Z') }],
    )
    const { LlmClientError } = await import('../src/services/insights/llm.client.js')
    mockGenerate
      .mockRejectedValueOnce(new LlmClientError('bad json', 'INVALID_JSON'))
      .mockRejectedValueOnce(new LlmClientError('bad json', 'INVALID_JSON'))

    await expect(generateInsightsForMatch('match-1')).rejects.toBeInstanceOf(InsightGenerationError)
    expect(mockGenerate).toHaveBeenCalledTimes(2)
  })

  it('retry succeeds: returns OK after one failure', async () => {
    mockSelectChain(
      { homeTeamName: 'Germany', awayTeamName: 'Spain' },
      [{ type: 'raw_stats', data: RAW_STATS, generatedAt: new Date('2026-05-25T10:00:00.000Z') }],
    )
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate })
    mockInsert.mockReturnValue({ values: insertValues })
    const { LlmClientError } = await import('../src/services/insights/llm.client.js')
    mockGenerate
      .mockRejectedValueOnce(new LlmClientError('bad', 'INVALID_JSON'))
      .mockResolvedValueOnce(FIVE_VALID_INSIGHTS)

    await generateInsightsForMatch('match-1')

    expect(mockGenerate).toHaveBeenCalledTimes(2)
    expect(insertValues).toHaveBeenCalledTimes(5)
  })
})
