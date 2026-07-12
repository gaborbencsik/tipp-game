import { describe, it, expect } from 'vitest'
import { calculatePoints, calculateScorerBonus, calculatePointsWithScorer, applyFavoriteTeamMultiplier, derivePointsResult } from '../src/services/scoring.service.js'
import type { ScoringConfig } from '../src/types/index.js'

const cfg: ScoringConfig = {
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}

describe('calculatePoints (3-field stackable)', () => {
  it('correct outcome + exact result → 2p (1 + 1)', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, cfg)).toBe(2)
  })

  it('correct outcome + not exact → 1p', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 2 }, cfg)).toBe(1)
  })

  it('draw prediction on draw outcome + ET/PK match → 3p (1 + 1 + 1)', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      cfg,
    )).toBe(3)
  })

  it('draw prediction on draw outcome, ET does not match → 2p (1 + 1, because exact result)', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_away' },
      cfg,
    )).toBe(2)
  })

  it('draw prediction on 2-1 outcome → 0p (wrong outcome)', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, cfg)).toBe(0)
  })

  it('wrong winner → 0p', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 1, awayGoals: 2 }, cfg)).toBe(0)
  })

  it('ET/PK bonus is NOT awarded on non-draw outcome', () => {
    expect(calculatePoints(
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      cfg,
    )).toBe(2)
  })

  it('draw prediction on draw outcome, both outcomes null → 2p (1 + 1, no ET bonus)', () => {
    expect(calculatePoints(
      { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null },
      { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null },
      cfg,
    )).toBe(2)
  })

  it('draw prediction on draw outcome, only prediction outcome present → 2p', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: null },
      cfg,
    )).toBe(2)
  })

  it('custom config: 2/3/1 → correct + exact = 5p', () => {
    const custom: ScoringConfig = { correctOutcomePoints: 2, exactBonusPoints: 3, extraTimeBonusPoints: 1 }
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, custom)).toBe(5)
  })

  // BUG-011: knockout match is a draw at 90 minutes, decided in extra time —
  // `match_results` stores the 90-minute score, so a draw prediction now also
  // earns correct-outcome + ET bonus points.
  describe('BUG-011: knockout match draw at 90 minutes, decided in ET/PK', () => {
    it('BEL-SEN: 1-1 prediction + extra_time_home, 2-2 (regular time) + extra_time_home result → 3p', () => {
      expect(calculatePoints(
        { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
        { homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'extra_time_home' },
        cfg,
      )).toBe(2)
    })

    it('BEL-SEN exact result: 2-2 prediction + extra_time_home, 2-2 + extra_time_home → 3p (1+1+1)', () => {
      expect(calculatePoints(
        { homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'extra_time_home' },
        { homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'extra_time_home' },
        cfg,
      )).toBe(3)
    })

    it('draw prediction on draw 90m result, ET does not match → 2p (1+1 exact)', () => {
      expect(calculatePoints(
        { homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'extra_time_home' },
        { homeGoals: 2, awayGoals: 2, outcomeAfterDraw: 'penalties_away' },
        cfg,
      )).toBe(2)
    })

    it('draw prediction on draw 90m result, ET matches but goals not exact → 2p (1+1 bonus)', () => {
      expect(calculatePoints(
        { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
        { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: 'extra_time_home' },
        cfg,
      )).toBe(2)
    })
  })
})

describe('applyFavoriteTeamMultiplier', () => {
  it('×2 multiplier on max 3p base → 6p', () => {
    const ctx = {
      userId: 'u1',
      groupFavoriteTeamDoublePoints: true,
      match: { homeTeamId: 't-home', awayTeamId: 't-away', leagueId: 'l1' },
      userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-home' }],
    }
    expect(applyFavoriteTeamMultiplier(3, ctx)).toBe(6)
  })

  it('flag disabled → no multiplier', () => {
    const ctx = {
      userId: 'u1',
      groupFavoriteTeamDoublePoints: false,
      match: { homeTeamId: 't-home', awayTeamId: 't-away', leagueId: 'l1' },
      userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-home' }],
    }
    expect(applyFavoriteTeamMultiplier(3, ctx)).toBe(3)
  })
})


// ─── SCORER-003: calculateScorerBonus ────────────────────────────────────────

describe('calculateScorerBonus', () => {
  it('no scorer pick → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: null, matchScorerPlayerIds: ['p1'] })).toBe(0)
  })

  it('scorer pick is in the scorers array → 1', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1', 'p2'] })).toBe(1)
  })

  it('scorer pick is not in the array → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p3', matchScorerPlayerIds: ['p1', 'p2'] })).toBe(0)
  })

  it('empty scorers array → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: [] })).toBe(0)
  })

  it('hat-trick (3 same ids) → 1 (set semantics)', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1', 'p1', 'p1'] })).toBe(1)
  })

  it('null scorer + empty array → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: null, matchScorerPlayerIds: [] })).toBe(0)
  })

  it('case-sensitive uuid match', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'P1', matchScorerPlayerIds: ['p1'] })).toBe(0)
  })

  it('finds match even at the end of a multi-id array', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p9', matchScorerPlayerIds: ['p1', 'p2', 'p9'] })).toBe(1)
  })
})

// ─── SCORER-003: calculatePointsWithScorer ───────────────────────────────────

describe('calculatePointsWithScorer (formula: (resultPoints + scorerBonus) * favoriteTeamMultiplier)', () => {
  const baseCtx = {
    userId: 'u1',
    groupFavoriteTeamDoublePoints: false,
    match: { homeTeamId: 't-home', awayTeamId: 't-away', leagueId: 'l1' },
    userFavorites: [],
  } as const

  it('correct outcome + exact result + scorer hit, no favorite → (1+1+1) * 1 = 3, scorerBonus=1', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 3, scorerBonusPoints: 1 })
  })

  it('correct outcome + scorer hit + favorite → (1+1) * 2 = 4, scorerBonus=1', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 2 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'] },
      {
        ...baseCtx,
        groupFavoriteTeamDoublePoints: true,
        userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-home' }],
      },
    )
    expect(out).toEqual({ pointsGlobal: 4, scorerBonusPoints: 1 })
  })

  it('wrong outcome + scorer hit, no favorite → (0+1) * 1 = 1', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 1, awayGoals: 2 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 1, scorerBonusPoints: 1 })
  })

  it('correct outcome + scorer NOT hit, no favorite → (1+0) * 1 = 1, scorerBonus=0', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 2 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p2'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 1, scorerBonusPoints: 0 })
  })

  it('correct outcome + scorer NOT hit + favorite → (1+0) * 2 = 2', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 2 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p2'] },
      {
        ...baseCtx,
        groupFavoriteTeamDoublePoints: true,
        userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-away' }],
      },
    )
    expect(out).toEqual({ pointsGlobal: 2, scorerBonusPoints: 0 })
  })

  it('no scorer pick → scorerBonus=0, points unchanged', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      cfg,
      { scorerPickPlayerId: null, matchScorerPlayerIds: ['p1'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 2, scorerBonusPoints: 0 })
  })
})

// ─── UX-033: derivePointsResult ──────────────────────────────────────────────

describe('derivePointsResult (result points without scorer bonus)', () => {
  it('null pointsGlobal → null', () => {
    expect(derivePointsResult(null, null)).toBeNull()
    expect(derivePointsResult(null, 0)).toBeNull()
    expect(derivePointsResult(null, 1)).toBeNull()
  })

  it('scorerBonus=0 or null → pointsResult = pointsGlobal', () => {
    expect(derivePointsResult(2, 0)).toBe(2)
    expect(derivePointsResult(2, null)).toBe(2)
    expect(derivePointsResult(0, 0)).toBe(0)
  })

  it('scorerBonus=1 → pointsResult = pointsGlobal − 1', () => {
    expect(derivePointsResult(3, 1)).toBe(2)
    expect(derivePointsResult(1, 1)).toBe(0)
  })
})
