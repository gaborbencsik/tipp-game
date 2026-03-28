import { describe, it, expect } from 'vitest'
import { calculatePoints } from '../src/services/scoring.service.js'
import type { ScoringConfig } from '../src/types/index.js'

const DEFAULT_CONFIG: ScoringConfig = {
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  incorrect: 0,
}

describe('calculatePoints', () => {
  // ─── Pontos találat ─────────────────────────────────────────────────────────

  it('pontos találat: 2-1 vs 2-1 → 3 pont', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('pontos találat: 0-0 vs 0-0 → 3 pont', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 0, awayGoals: 0 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('pontos találat: 3-3 vs 3-3 → 3 pont', () => {
    expect(calculatePoints({ homeGoals: 3, awayGoals: 3 }, { homeGoals: 3, awayGoals: 3 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('pontos találat: nagy gólszám 5-4 vs 5-4 → 3 pont', () => {
    expect(calculatePoints({ homeGoals: 5, awayGoals: 4 }, { homeGoals: 5, awayGoals: 4 }, DEFAULT_CONFIG)).toBe(3)
  })

  // ─── Helyes győztes + azonos gólkülönbség ───────────────────────────────────

  it('helyes győztes + azonos diff: 3-1 tipp, 2-0 eredmény (diff=2) → 2 pont', () => {
    expect(calculatePoints({ homeGoals: 3, awayGoals: 1 }, { homeGoals: 2, awayGoals: 0 }, DEFAULT_CONFIG)).toBe(2)
  })

  it('helyes győztes + azonos diff: 4-2 tipp, 3-1 eredmény (diff=2) → 2 pont', () => {
    expect(calculatePoints({ homeGoals: 4, awayGoals: 2 }, { homeGoals: 3, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(2)
  })

  it('helyes győztes + azonos diff: 0-2 tipp, 1-3 eredmény (diff=-2) → 2 pont', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 2 }, { homeGoals: 1, awayGoals: 3 }, DEFAULT_CONFIG)).toBe(2)
  })

  // ─── Csak helyes győztes ─────────────────────────────────────────────────────

  it('csak helyes győztes: 2-1 tipp, 3-1 eredmény → 1 pont', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(1)
  })

  it('csak helyes győztes: 1-0 tipp, 4-1 eredmény → 1 pont', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 0 }, { homeGoals: 4, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(1)
  })

  it('csak helyes győztes: 0-2 tipp, 0-1 eredmény → 1 pont', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 2 }, { homeGoals: 0, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(1)
  })

  // ─── Helyes döntetlen ───────────────────────────────────────────────────────

  it('helyes döntetlen: 1-1 tipp, 1-1 eredmény → 3 pont (pontos találat)', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 1, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(3)
  })

  it('helyes döntetlen: 0-0 tipp, 2-2 eredmény → 2 pont (correct draw)', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 2, awayGoals: 2 }, DEFAULT_CONFIG)).toBe(2)
  })

  it('helyes döntetlen: 2-2 tipp, 1-1 eredmény → 2 pont (correct draw)', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 2 }, { homeGoals: 1, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(2)
  })

  // ─── Helytelen döntetlen tipp ───────────────────────────────────────────────

  it('döntetlen tipp, hazai győztes eredmény: 0-0 tipp, 1-0 eredmény → 0 pont', () => {
    expect(calculatePoints({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 }, DEFAULT_CONFIG)).toBe(0)
  })

  it('döntetlen tipp, vendég győztes eredmény: 1-1 tipp, 0-1 eredmény → 0 pont', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 0, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(0)
  })

  // ─── Teljesen helytelen ──────────────────────────────────────────────────────

  it('teljesen helytelen: 1-0 tipp, 0-1 eredmény → 0 pont', () => {
    expect(calculatePoints({ homeGoals: 1, awayGoals: 0 }, { homeGoals: 0, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(0)
  })

  it('teljesen helytelen: 3-0 tipp, 0-2 eredmény → 0 pont', () => {
    expect(calculatePoints({ homeGoals: 3, awayGoals: 0 }, { homeGoals: 0, awayGoals: 2 }, DEFAULT_CONFIG)).toBe(0)
  })

  // ─── Custom konfig ──────────────────────────────────────────────────────────

  it('custom konfig: pontos találat más értékkel', () => {
    const customConfig: ScoringConfig = {
      exactScore: 5,
      correctWinnerAndDiff: 3,
      correctWinner: 2,
      correctDraw: 3,
      incorrect: 0,
    }
    expect(calculatePoints({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }, customConfig)).toBe(5)
  })

  it('hazai győztes tipp, döntetlen eredmény → 0 pont', () => {
    expect(calculatePoints({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 1, awayGoals: 1 }, DEFAULT_CONFIG)).toBe(0)
  })
})
