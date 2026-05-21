import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
}))

const liveStateMocks = vi.hoisted(() => ({
  upsertLiveState: vi.fn().mockResolvedValue(undefined),
  deleteLiveState: vi.fn().mockResolvedValue(undefined),
  finalizeLiveToResult: vi.fn().mockResolvedValue({ wasInserted: true, scoreChanged: false }),
}))

const scoringMocks = vi.hoisted(() => ({
  calculateAndSavePoints: vi.fn().mockResolvedValue(undefined),
  calculateAndSaveGroupPoints: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))

vi.mock('../src/services/live-match-state.service.js', () => liveStateMocks)
vi.mock('../src/services/scoring.service.js', () => scoringMocks)

import { upsertResults } from '../src/services/sync.service.js'
import type { ApiFootballFixture } from '../src/types/index.js'

function fixture(opts: {
  id: number
  short: string
  homeGoals?: number | null
  awayGoals?: number | null
  elapsed?: number | null
  pen?: { home: number | null; away: number | null }
}): ApiFootballFixture {
  return {
    fixture: {
      id: opts.id,
      date: '2026-06-15T18:00:00+00:00',
      status: { short: opts.short, long: '', elapsed: opts.elapsed ?? null },
      venue: { id: null, name: null, city: null },
    },
    league: { id: 10, round: 'Regular Season - 1' },
    teams: {
      home: { id: 1, name: 'A', code: null, logo: '', national: true },
      away: { id: 2, name: 'B', code: null, logo: '', national: true },
    },
    goals: { home: opts.homeGoals ?? null, away: opts.awayGoals ?? null },
    score: {
      fulltime: { home: null, away: null },
      penalty: opts.pen ?? { home: null, away: null },
    },
  }
}

function mockMatchLookup(matchId: string | null): void {
  const limit = vi.fn().mockResolvedValue(matchId ? [{ id: matchId }] : [])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  mockDb.select.mockReturnValue({ from })
}

describe('upsertResults – live/finished/cancelled branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    liveStateMocks.finalizeLiveToResult.mockResolvedValue({ wasInserted: true, scoreChanged: false })
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    mockDb.update.mockReturnValue({ set: updateSet })
  })

  it('writes live state for live fixture with goals', async () => {
    mockMatchLookup('m-uuid')
    await upsertResults([fixture({ id: 100, short: '2H', homeGoals: 2, awayGoals: 1, elapsed: 67 })])

    expect(liveStateMocks.upsertLiveState).toHaveBeenCalledWith({
      matchId: 'm-uuid',
      homeScore: 2,
      awayScore: 1,
      minute: 67,
      apiStatus: '2H',
    })
    expect(liveStateMocks.finalizeLiveToResult).not.toHaveBeenCalled()
    expect(scoringMocks.calculateAndSavePoints).not.toHaveBeenCalled()
  })

  it('skips live fixture with null goals', async () => {
    mockMatchLookup('m-uuid')
    await upsertResults([fixture({ id: 100, short: '1H', homeGoals: null, awayGoals: null })])

    expect(liveStateMocks.upsertLiveState).not.toHaveBeenCalled()
  })

  it('finalizes finished fixture (delete live + insert result + score points)', async () => {
    mockMatchLookup('m-uuid')
    await upsertResults([fixture({ id: 100, short: 'FT', homeGoals: 2, awayGoals: 1 })])

    expect(liveStateMocks.finalizeLiveToResult).toHaveBeenCalledWith({
      matchId: 'm-uuid',
      homeGoals: 2,
      awayGoals: 1,
      outcomeAfterDraw: null,
    })
    expect(scoringMocks.calculateAndSavePoints).toHaveBeenCalledOnce()
    expect(scoringMocks.calculateAndSaveGroupPoints).toHaveBeenCalledOnce()
    expect(liveStateMocks.upsertLiveState).not.toHaveBeenCalled()
  })

  it('passes outcomeAfterDraw on PEN-finalized fixture', async () => {
    mockMatchLookup('m-uuid')
    await upsertResults([fixture({
      id: 100, short: 'PEN', homeGoals: 1, awayGoals: 1, pen: { home: 5, away: 3 },
    })])

    const callArgs = liveStateMocks.finalizeLiveToResult.mock.calls[0]?.[0]
    expect(callArgs).toMatchObject({ matchId: 'm-uuid', homeGoals: 1, awayGoals: 1 })
    expect(callArgs?.outcomeAfterDraw).toBeTruthy()
  })

  it('deletes live state for cancelled fixture', async () => {
    mockMatchLookup('m-uuid')
    await upsertResults([fixture({ id: 100, short: 'CANC', homeGoals: null, awayGoals: null })])

    expect(liveStateMocks.deleteLiveState).toHaveBeenCalledWith('m-uuid')
    expect(liveStateMocks.upsertLiveState).not.toHaveBeenCalled()
    expect(liveStateMocks.finalizeLiveToResult).not.toHaveBeenCalled()
  })

  it('ignores fixture not found in db', async () => {
    mockMatchLookup(null)
    await upsertResults([fixture({ id: 100, short: 'FT', homeGoals: 2, awayGoals: 1 })])

    expect(liveStateMocks.finalizeLiveToResult).not.toHaveBeenCalled()
    expect(liveStateMocks.upsertLiveState).not.toHaveBeenCalled()
  })

  it('skips scheduled (NS) fixtures', async () => {
    mockMatchLookup('m-uuid')
    await upsertResults([fixture({ id: 100, short: 'NS', homeGoals: null, awayGoals: null })])

    expect(mockDb.select).not.toHaveBeenCalled()
    expect(liveStateMocks.upsertLiveState).not.toHaveBeenCalled()
  })

  it('skips scoring when result already exists and score unchanged', async () => {
    mockMatchLookup('m-uuid')
    liveStateMocks.finalizeLiveToResult.mockResolvedValueOnce({ wasInserted: false, scoreChanged: false })
    await upsertResults([fixture({ id: 100, short: 'FT', homeGoals: 2, awayGoals: 1 })])

    expect(liveStateMocks.finalizeLiveToResult).toHaveBeenCalledOnce()
    expect(scoringMocks.calculateAndSavePoints).not.toHaveBeenCalled()
    expect(scoringMocks.calculateAndSaveGroupPoints).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('rescoring runs when score changed (correction)', async () => {
    mockMatchLookup('m-uuid')
    liveStateMocks.finalizeLiveToResult.mockResolvedValueOnce({ wasInserted: false, scoreChanged: true })
    await upsertResults([fixture({ id: 100, short: 'FT', homeGoals: 2, awayGoals: 1 })])

    expect(scoringMocks.calculateAndSavePoints).toHaveBeenCalledOnce()
    expect(scoringMocks.calculateAndSaveGroupPoints).toHaveBeenCalledOnce()
    expect(mockDb.update).toHaveBeenCalledOnce()
  })

  it('marks pointsCalculatedAt after successful scoring on insert', async () => {
    mockMatchLookup('m-uuid')
    liveStateMocks.finalizeLiveToResult.mockResolvedValueOnce({ wasInserted: true, scoreChanged: false })
    await upsertResults([fixture({ id: 100, short: 'FT', homeGoals: 2, awayGoals: 1 })])

    expect(mockDb.update).toHaveBeenCalledOnce()
  })
})
