import { describe, it, expect } from 'vitest'
import { calculatePoints } from '../src/services/scoring.service.js'
import type { ScoringConfig } from '../src/types/index.js'

const DEFAULT_CONFIG: ScoringConfig = {
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
}

describe('calculatePoints', () => {
  // ─── Exact score ─────────────────────────────────────────────────────────────

  it('exact score: 2-1 vs 2-1 → 3 points', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('exact score: 0-0 vs 0-0 → 3 points', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 0, awayGoals: 0 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('exact score: 3-3 vs 3-3 → 3 points', () => {
    expect(calculatePoints({ homeGoals: 3, awayGoals: 3 }, { homeGoals: 3, awayGoals: 3 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('exact score: high-scoring 5-4 vs 5-4 → 3 points', () => {
    expect(calculatePoints({ homeGoals: 5, awayGoals: 4 }, { homeGoals: 5, awayGoals: 4 }, DEFAULT_CONFIG)).toBe(3)
  })

  // ─── Correct winner + same goal difference ───────────────────────────────────

  it('correct winner + same diff: 3-1 predicted, 2-0 actual (diff=2) → 2 points', () => {
    expect(calculatePoints({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 2, awayGoals: 0 }, DEFAULT_CONFIG)).toBe(2)
  })

  it('correct winner + same diff: 4-2 predicted, 3-1 actual (diff=2) → 2 points', () => {
    expect(calculatePoints({ homeGoals: 4, awayGoals: 2 }, { homeGoals: 3, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(2)
  })

  it('correct winner + same diff: 0-2 predicted, 1-3 actual (diff=-2) → 2 points', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 2 }, { homeGoals: 1, awayGoals: 3 }, DEFAULT_CONFIG)).toBe(2)
  })

  // ─── Correct winner only ─────────────────────────────────────────────────────

  it('correct winner only: 2-1 predicted, 3-1 actual → 1 point', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(1)
  })

  it('correct winner only: 1-0 predicted, 4-1 actual → 1 point', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 0 }, { homeGoals: 4, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(1)
  })

  it('correct winner only: 0-2 predicted, 0-1 actual → 1 point', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 2 }, { homeGoals: 0, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(1)
  })

  // ─── Correct draw ────────────────────────────────────────────────────────────

  it('correct draw: 1-1 predicted, 1-1 actual → 3 points (exact score)', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 1, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('correct draw: 0-0 predicted, 2-2 actual → 2 points (correct draw)', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 2, awayGoals: 2 }, DEFAULT_CONFIG)).toBe(2)
  })

  it('correct draw: 2-2 predicted, 1-1 actual → 2 points (correct draw)', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 2 }, { homeGoals: 1, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(2)
  })

  // ─── Incorrect draw prediction ───────────────────────────────────────────────

  it('draw predicted, home win actual: 0-0 predicted, 1-0 actual → 0 points', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 }, DEFAULT_CONFIG)).toBe(0)
  })

  it('draw predicted, away win actual: 1-1 predicted, 0-1 actual → 0 points', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 0, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(0)
  })

  // ─── Completely wrong ────────────────────────────────────────────────────────

  it('completely wrong: 1-0 predicted, 0-1 actual → 0 points', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 0 }, { homeGoals: 0, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(0)
  })

  it('completely wrong: 3-0 predicted, 0-2 actual → 0 points', () => {
    expect(calculatePoints({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 0, awayGoals: 2 }, DEFAULT_CONFIG)).toBe(0)
  })

  // ─── Custom config ───────────────────────────────────────────────────────────

  it('custom config: exact score with different point value', () => {
    const customConfig: ScoringConfig = {
      exactScore: 5,
      correctWinnerAndDiff: 3,
      correctWinner: 2,
      correctDraw: 3,
      correctOutcome: 1,
      incorrect: 0,
    }
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, customConfig)).toBe(5)
  })

  it('home win predicted, draw actual → 0 points', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 1, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(0)
  })

  // ─── Outcome after draw bonus ─────────────────────────────────────────────────

  it('outcome: exact draw + correct outcome → exactScore + correctOutcome', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      DEFAULT_CONFIG,
    )).toBe(4) // exactScore(3) + correctOutcome(1)
  })

  it('outcome: correct draw (non-exact) + correct outcome → correctDraw + correctOutcome', () => {
    expect(calculatePoints(
      { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: 'penalties_away' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_away' },
      DEFAULT_CONFIG,
    )).toBe(3) // correctDraw(2) + correctOutcome(1)
  })

  it('outcome: correct draw + wrong outcome → only correctDraw', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      DEFAULT_CONFIG,
    )).toBe(3) // exactScore(3), no outcome bonus
  })

  it('outcome: correct draw + no outcome tipped → no bonus', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: null },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_away' },
      DEFAULT_CONFIG,
    )).toBe(3) // exactScore(3), no outcome bonus
  })

  it('outcome: result has no outcomeAfterDraw → no bonus even if tipped', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: null },
      DEFAULT_CONFIG,
    )).toBe(3) // exactScore(3), no outcome bonus
  })

  it('outcome: non-draw result → outcome bonus never applies', () => {
    expect(calculatePoints(
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      DEFAULT_CONFIG,
    )).toBe(3) // exactScore(3), outcome is irrelevant for non-draw
  })
})
