import { describe, it, expect } from 'vitest'
import { computeMyStats, type ScoringBuckets } from './useMyStats.js'
import type { Match, Prediction } from '../types/index.js'

const baseTeam = (id: string, name: string) => ({
  id,
  name,
  shortCode: name.slice(0, 3).toUpperCase(),
  flagUrl: null,
  teamType: 'national' as const,
  countryCode: null,
})

function match(id: string, scheduledAt: string, status: Match['status'] = 'finished'): Match {
  return {
    id,
    homeTeam: baseTeam(`${id}-h`, 'Home'),
    awayTeam: baseTeam(`${id}-a`, 'Away'),
    venue: null,
    league: null,
    stage: 'group',
    groupName: null,
    matchNumber: null,
    scheduledAt,
    status,
    result: null,
  }
}

function pred(matchId: string, points: number | null): Prediction {
  return {
    id: `p-${matchId}`,
    userId: 'u1',
    matchId,
    homeGoals: 1,
    awayGoals: 0,
    outcomeAfterDraw: null,
    pointsGlobal: points,
    scorerPickPlayerId: null,
    scorerPlayerNameSnapshot: null,
    scorerBonusPoints: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function scorerPred(
  matchId: string,
  points: number | null,
  scorerBonus: number | null,
): Prediction {
  return {
    ...pred(matchId, points),
    scorerPickPlayerId: `player-${matchId}`,
    scorerPlayerNameSnapshot: `Player ${matchId}`,
    scorerBonusPoints: scorerBonus,
  }
}

const config: ScoringBuckets = {
  correctOutcomePoints: 1,
  exactBonusPoints: 2,
  extraTimeBonusPoints: 1,
}

describe('computeMyStats', () => {
  it('zero predictions → all zeros', () => {
    const stats = computeMyStats([], [], config)
    expect(stats.submittedCount).toBe(0)
    expect(stats.totalAvailable).toBe(0)
    expect(stats.totalPoints).toBe(0)
    expect(stats.evaluatedCount).toBe(0)
    expect(stats.correctCount).toBe(0)
    expect(stats.accuracyPercent).toBe(0)
    expect(stats.bestStreak).toBe(0)
    expect(stats.currentStreak).toBe(0)
    expect(stats.distribution).toEqual({
      exact: 0, winner: 0, incorrect: 0, missed: 0,
    })
  })

  it('totalAvailable counts scheduled + live + finished', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z', 'finished'),
      match('m2', '2026-06-02T18:00:00Z', 'live'),
      match('m3', '2026-06-03T18:00:00Z', 'scheduled'),
      match('m4', '2026-06-04T18:00:00Z', 'cancelled'),
    ]
    const stats = computeMyStats([], matches, config)
    expect(stats.totalAvailable).toBe(3)
  })

  it('submittedCount counts predictions that map to a match', () => {
    const matches = [match('m1', '2026-06-01T18:00:00Z')]
    const predictions = [pred('m1', 5), pred('m-orphan', 3)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.submittedCount).toBe(1)
  })

  it('totalPoints sums pointsGlobal across evaluated predictions', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z', 'scheduled'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 2), pred('m3', null)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.totalPoints).toBe(7)
    expect(stats.evaluatedCount).toBe(2)
  })

  it('accuracyPercent = correct / evaluated, rounded', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 0), pred('m3', 3)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.correctCount).toBe(2)
    expect(stats.accuracyPercent).toBe(67)
  })

  it('bestStreak finds longest run of correct (>0) by scheduledAt asc', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
      match('m4', '2026-06-04T18:00:00Z'),
      match('m5', '2026-06-05T18:00:00Z'),
    ]
    // points order asc by date: 5, 3, 0, 2, 5  → bestStreak among (1,2) = 2 then (4,5) = 2
    const predictions = [pred('m1', 5), pred('m2', 3), pred('m3', 0), pred('m4', 2), pred('m5', 5)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.bestStreak).toBe(2)
  })

  it('bestStreak when all correct = evaluatedCount', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 2), pred('m3', 1)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.bestStreak).toBe(3)
  })

  it('currentStreak positive when last evaluated is correct', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
    ]
    const predictions = [pred('m1', 0), pred('m2', 5), pred('m3', 3)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.currentStreak).toBe(2)
  })

  it('currentStreak negative when last evaluated is zero', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 0), pred('m3', 0)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.currentStreak).toBe(-2)
  })

  it('currentStreak ignores non-evaluated predictions', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z', 'scheduled'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 3), pred('m3', null)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.currentStreak).toBe(2)
  })

  it('distribution buckets by points using scoring config', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
      match('m4', '2026-06-04T18:00:00Z'),
      match('m5', '2026-06-05T18:00:00Z'),
    ]
    // exactThreshold = 1 + 2 = 3
    const predictions = [
      pred('m1', 5), // ≥3 → exact
      pred('m2', 3), // ≥3 → exact
      pred('m3', 2), // <3, >0 → winner
      pred('m4', 1), // <3, >0 → winner
      pred('m5', 0), // 0 → incorrect
    ]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.distribution).toEqual({
      exact: 2, winner: 2, incorrect: 1, missed: 0,
    })
  })

  it('distribution.missed = finished matches without prediction', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z', 'finished'),
      match('m2', '2026-06-02T18:00:00Z', 'finished'),
      match('m3', '2026-06-03T18:00:00Z', 'scheduled'),
    ]
    const predictions = [pred('m1', 5)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.distribution.missed).toBe(1)
  })

  it('null scoring config → all evaluated land in incorrect or exact bucket', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 0)]
    const stats = computeMyStats(predictions, matches, null)
    expect(stats.distribution.exact).toBe(1)
    expect(stats.distribution.incorrect).toBe(1)
  })

  it('exactHits = 0 when no predictions and config is present', () => {
    const stats = computeMyStats([], [], config)
    expect(stats.exactHits).toBe(0)
  })

  it('exactHits matches the exact bucket for mixed predictions with config', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
      match('m3', '2026-06-03T18:00:00Z'),
      match('m4', '2026-06-04T18:00:00Z'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 5), pred('m3', 2), pred('m4', 0)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.exactHits).toBe(2)
    expect(stats.exactHits).toBe(stats.distribution.exact)
  })

  it('exactHits = 0 when only non-evaluated predictions', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z', 'scheduled'),
      match('m2', '2026-06-02T18:00:00Z', 'scheduled'),
    ]
    const predictions = [pred('m1', null), pred('m2', null)]
    const stats = computeMyStats(predictions, matches, config)
    expect(stats.exactHits).toBe(0)
  })

  it('exactHits = null when scoring config is null (heuristic exact bucket must not surface as headline KPI)', () => {
    const matches = [
      match('m1', '2026-06-01T18:00:00Z'),
      match('m2', '2026-06-02T18:00:00Z'),
    ]
    const predictions = [pred('m1', 5), pred('m2', 0)]
    const stats = computeMyStats(predictions, matches, null)
    expect(stats.exactHits).toBeNull()
  })

  it('exactHits = null when config is null even with no predictions', () => {
    const stats = computeMyStats([], [], null)
    expect(stats.exactHits).toBeNull()
  })

  describe('scorer stats', () => {
    it('zero scorer picks → all scorer counts = 0', () => {
      const stats = computeMyStats([], [], config)
      expect(stats.scorerSubmittedCount).toBe(0)
      expect(stats.scorerHitCount).toBe(0)
      expect(stats.scorerTotalBonus).toBe(0)
    })

    it('plain (non-scorer) predictions do not contribute to scorer counts', () => {
      const matches = [
        match('m1', '2026-06-01T18:00:00Z'),
        match('m2', '2026-06-02T18:00:00Z'),
      ]
      const predictions = [pred('m1', 5), pred('m2', 0)]
      const stats = computeMyStats(predictions, matches, config)
      expect(stats.scorerSubmittedCount).toBe(0)
      expect(stats.scorerHitCount).toBe(0)
      expect(stats.scorerTotalBonus).toBe(0)
    })

    it('one hit scorer pick → submitted=1, hit=1, bonus=1', () => {
      const matches = [match('m1', '2026-06-01T18:00:00Z')]
      const predictions = [scorerPred('m1', 5, 1)]
      const stats = computeMyStats(predictions, matches, config)
      expect(stats.scorerSubmittedCount).toBe(1)
      expect(stats.scorerHitCount).toBe(1)
      expect(stats.scorerTotalBonus).toBe(1)
    })

    it('one miss scorer pick → submitted=1, hit=0, bonus=0', () => {
      const matches = [match('m1', '2026-06-01T18:00:00Z')]
      const predictions = [scorerPred('m1', 1, 0)]
      const stats = computeMyStats(predictions, matches, config)
      expect(stats.scorerSubmittedCount).toBe(1)
      expect(stats.scorerHitCount).toBe(0)
      expect(stats.scorerTotalBonus).toBe(0)
    })

    it('not yet evaluated scorer pick → submitted=1, hit=0, bonus=0', () => {
      const matches = [match('m1', '2026-06-01T18:00:00Z', 'scheduled')]
      const predictions = [scorerPred('m1', null, null)]
      const stats = computeMyStats(predictions, matches, config)
      expect(stats.scorerSubmittedCount).toBe(1)
      expect(stats.scorerHitCount).toBe(0)
      expect(stats.scorerTotalBonus).toBe(0)
    })

    it('mixed scorer picks (3 submitted, 2 hit) aggregate correctly', () => {
      const matches = [
        match('m1', '2026-06-01T18:00:00Z'),
        match('m2', '2026-06-02T18:00:00Z'),
        match('m3', '2026-06-03T18:00:00Z'),
        match('m4', '2026-06-04T18:00:00Z'),
      ]
      const predictions = [
        scorerPred('m1', 5, 1), // hit
        scorerPred('m2', 1, 0), // miss
        scorerPred('m3', 5, 1), // hit
        pred('m4', 5),          // not a scorer pick
      ]
      const stats = computeMyStats(predictions, matches, config)
      expect(stats.scorerSubmittedCount).toBe(3)
      expect(stats.scorerHitCount).toBe(2)
      expect(stats.scorerTotalBonus).toBe(2)
    })

    it('scorer stats ignore predictions whose match is missing', () => {
      const matches = [match('m1', '2026-06-01T18:00:00Z')]
      const predictions = [
        scorerPred('m1', 5, 1),
        scorerPred('m-orphan', 5, 1),
      ]
      const stats = computeMyStats(predictions, matches, config)
      expect(stats.scorerSubmittedCount).toBe(1)
      expect(stats.scorerHitCount).toBe(1)
    })
  })
})
