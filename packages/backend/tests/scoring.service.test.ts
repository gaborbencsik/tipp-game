import { describe, it, expect } from 'vitest'
import { calculatePoints, applyFavoriteTeamMultiplier } from '../src/services/scoring.service.js'
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
