import { describe, it, expect } from 'vitest'
import { calculatePoints, calculateScorerBonus, calculatePointsWithScorer, applyFavoriteTeamMultiplier, derivePointsResult } from '../src/services/scoring.service.js'
import type { ScoringConfig } from '../src/types/index.js'

const cfg: ScoringConfig = {
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}

describe('calculatePoints (3-field stackable)', () => {
  it('helyes kimenetel + pontos eredmény → 2p (1 + 1)', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, cfg)).toBe(2)
  })

  it('helyes kimenetel + nem pontos → 1p', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 2 }, cfg)).toBe(1)
  })

  it('döntetlen tipp döntetlen kimenetelre + ET/PKK egyezés → 3p (1 + 1 + 1)', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      cfg,
    )).toBe(3)
  })

  it('döntetlen tipp döntetlenre, ET nem egyezik → 2p (1 + 1, mert pontos eredmény)', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_away' },
      cfg,
    )).toBe(2)
  })

  it('döntetlen tipp 2-1 eredményre → 0p (rossz kimenetel)', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, cfg)).toBe(0)
  })

  it('rossz győztes → 0p', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 1, awayGoals: 2 }, cfg)).toBe(0)
  })

  it('ET/PKK bónusz NEM jár nem-döntetlen eredményre', () => {
    expect(calculatePoints(
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
      cfg,
    )).toBe(2)
  })

  it('döntetlen tipp döntetlen eredményre, mindkét outcome null → 2p (1 + 1, nincs ET bónusz)', () => {
    expect(calculatePoints(
      { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null },
      { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null },
      cfg,
    )).toBe(2)
  })

  it('döntetlen tipp döntetlen eredményre, csak prediction outcome van → 2p', () => {
    expect(calculatePoints(
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'extra_time_home' },
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: null },
      cfg,
    )).toBe(2)
  })

  it('custom config: 2/3/1 → helyes + pontos = 5p', () => {
    const custom: ScoringConfig = { correctOutcomePoints: 2, exactBonusPoints: 3, extraTimeBonusPoints: 1 }
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, custom)).toBe(5)
  })
})

describe('applyFavoriteTeamMultiplier', () => {
  it('×2 multiplier max 3p alapra → 6p', () => {
    const ctx = {
      userId: 'u1',
      groupFavoriteTeamDoublePoints: true,
      match: { homeTeamId: 't-home', awayTeamId: 't-away', leagueId: 'l1' },
      userFavorites: [{ userId: 'u1', leagueId: 'l1', teamId: 't-home' }],
    }
    expect(applyFavoriteTeamMultiplier(3, ctx)).toBe(6)
  })

  it('flag kikapcsolva → nincs multiplier', () => {
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
  it('nincs scorer pick → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: null, matchScorerPlayerIds: ['p1'] })).toBe(0)
  })

  it('scorer pick benne van a góllövő tömbben → 1', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1', 'p2'] })).toBe(1)
  })

  it('scorer pick nincs benne → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p3', matchScorerPlayerIds: ['p1', 'p2'] })).toBe(0)
  })

  it('üres góllövő tömb → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: [] })).toBe(0)
  })

  it('hat-trick (3 ugyanaz az id) → 1 (set semantics)', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1', 'p1', 'p1'] })).toBe(1)
  })

  it('null scorer + üres tömb → 0', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: null, matchScorerPlayerIds: [] })).toBe(0)
  })

  it('case-sensitive uuid match', () => {
    expect(calculateScorerBonus({ scorerPickPlayerId: 'P1', matchScorerPlayerIds: ['p1'] })).toBe(0)
  })

  it('több id között a végén is megtalálja', () => {
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

  it('helyes kimenetel + pontos eredmény + scorer talált, nincs kedvenc → (1+1+1) * 1 = 3, scorerBonus=1', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 2, awayGoals: 1 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 3, scorerBonusPoints: 1 })
  })

  it('helyes kimenetel + scorer talált + kedvenc → (1+1) * 2 = 4, scorerBonus=1', () => {
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

  it('rossz kimenetel + scorer talált, nincs kedvenc → (0+1) * 1 = 1', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 1, awayGoals: 2 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p1'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 1, scorerBonusPoints: 1 })
  })

  it('helyes kimenetel + scorer NEM talált, nincs kedvenc → (1+0) * 1 = 1, scorerBonus=0', () => {
    const out = calculatePointsWithScorer(
      { homeGoals: 2, awayGoals: 1 },
      { homeGoals: 3, awayGoals: 2 },
      cfg,
      { scorerPickPlayerId: 'p1', matchScorerPlayerIds: ['p2'] },
      baseCtx,
    )
    expect(out).toEqual({ pointsGlobal: 1, scorerBonusPoints: 0 })
  })

  it('helyes kimenetel + scorer NEM talált + kedvenc → (1+0) * 2 = 2', () => {
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

  it('nincs scorer tipp → scorerBonus=0, pontok változatlanok', () => {
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

describe('derivePointsResult (eredmény-pont scorer bonus nélkül)', () => {
  it('null pointsGlobal → null', () => {
    expect(derivePointsResult(null, null)).toBeNull()
    expect(derivePointsResult(null, 0)).toBeNull()
    expect(derivePointsResult(null, 1)).toBeNull()
  })

  it('scorerBonus=0 vagy null → pointsResult = pointsGlobal', () => {
    expect(derivePointsResult(2, 0)).toBe(2)
    expect(derivePointsResult(2, null)).toBe(2)
    expect(derivePointsResult(0, 0)).toBe(0)
  })

  it('scorerBonus=1 → pointsResult = pointsGlobal − 1', () => {
    expect(derivePointsResult(3, 1)).toBe(2)
    expect(derivePointsResult(1, 1)).toBe(0)
  })
})
