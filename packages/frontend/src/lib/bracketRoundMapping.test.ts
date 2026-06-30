import { describe, it, expect } from 'vitest'
import {
  mapRoundWinnersToBracketAnswer,
  BracketTeamNotInRoundError,
} from './bracketRoundMapping.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
} from '../types/index.js'

// Minimal template: 2 last_32 matches → 1 last_16 → 1 final (no QF/SF), plus a bronze stub.
// The slotA/slotB resolution falls back through group standings + winners cascade.
const TEMPLATE: readonly BracketMatch[] = [
  { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: 'l16_m1' },
  { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'RU_D1', winnerTo: 'l16_m1' },
  { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
  { id: 'final',  round: 'final',  slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
  { id: 'bronze', round: 'bronze', slotA: '<l16_m1_loser>', slotB: '<l16_m1_loser>', winnerTo: null },
]

const T = (g: string, n: number): string =>
  `${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}-0000-0000-0000-00000000000${n}`

const STANDINGS: AllGroupsStandingAnswer = {
  groups: {
    A: [T('A', 1), T('A', 2), T('A', 3), T('A', 4)],
    B: [T('B', 1), T('B', 2), T('B', 3), T('B', 4)],
    C: [T('C', 1), T('C', 2), T('C', 3), T('C', 4)],
    D: [T('D', 1), T('D', 2), T('D', 3), T('D', 4)],
  },
  best3rds: [],
}

describe('mapRoundWinnersToBracketAnswer — last_32 (slots resolved from standings)', () => {
  it('maps two selected winners to their matches by team membership', () => {
    // l32_m1 pairs A1 vs B2; l32_m2 pairs C1 vs D2.
    const selected = [T('A', 1), T('D', 2)]
    const result = mapRoundWinnersToBracketAnswer(
      'last_32', selected, null, TEMPLATE, STANDINGS,
    )
    expect(result.winners).toEqual({
      l32_m1: T('A', 1),
      l32_m2: T('D', 2),
    })
  })

  it('preserves winners from other rounds when present', () => {
    const prev: BracketProgressionAnswer = { winners: { final: T('A', 1) } }
    const selected = [T('A', 1), T('C', 1)]
    const result = mapRoundWinnersToBracketAnswer(
      'last_32', selected, prev, TEMPLATE, STANDINGS,
    )
    expect(result.winners.final).toBe(T('A', 1))
    expect(result.winners.l32_m1).toBe(T('A', 1))
    expect(result.winners.l32_m2).toBe(T('C', 1))
  })

  it('replaces previous winners of the same round (idempotent on re-save)', () => {
    const prev: BracketProgressionAnswer = {
      winners: { l32_m1: T('A', 1), l32_m2: T('C', 1) },
    }
    const selected = [T('B', 2), T('D', 2)]
    const result = mapRoundWinnersToBracketAnswer(
      'last_32', selected, prev, TEMPLATE, STANDINGS,
    )
    expect(result.winners).toEqual({
      l32_m1: T('B', 2),
      l32_m2: T('D', 2),
    })
  })

  it('throws BracketTeamNotInRoundError when a selected team is not part of any match', () => {
    const selected = [T('A', 1), T('A', 4)] // A4 is in no l32 match
    expect(() => mapRoundWinnersToBracketAnswer(
      'last_32', selected, null, TEMPLATE, STANDINGS,
    )).toThrow(BracketTeamNotInRoundError)
  })
})

describe('mapRoundWinnersToBracketAnswer — last_16 (cascade from previous round winners)', () => {
  it('maps last_16 winner using upstream l32 winners', () => {
    const prev: BracketProgressionAnswer = {
      winners: { l32_m1: T('A', 1), l32_m2: T('C', 1) },
    }
    const result = mapRoundWinnersToBracketAnswer(
      'last_16', [T('A', 1)], prev, TEMPLATE, STANDINGS,
    )
    expect(result.winners).toEqual({
      l32_m1: T('A', 1),
      l32_m2: T('C', 1),
      l16_m1: T('A', 1),
    })
  })

  it('throws when upstream winners are missing (slots unresolvable)', () => {
    expect(() => mapRoundWinnersToBracketAnswer(
      'last_16', [T('A', 1)], null, TEMPLATE, STANDINGS,
    )).toThrow(BracketTeamNotInRoundError)
  })
})

describe('mapRoundWinnersToBracketAnswer — bronze (losers of SF / upstream)', () => {
  it('maps bronze winner from the upstream loser pool', () => {
    // l16_m1 winner = A1; loser is whichever team faced A1 in l32 → l16 cascade.
    // l32_m1: A1 wins (so RU_B1=B2 is loser); l32_m2: C1 wins (so D2 loser).
    // l16_m1 pairs <l32_m1>=A1 vs <l32_m2>=C1; if A1 wins, C1 is the loser.
    const prev: BracketProgressionAnswer = {
      winners: { l32_m1: T('A', 1), l32_m2: T('C', 1), l16_m1: T('A', 1) },
    }
    const result = mapRoundWinnersToBracketAnswer(
      'bronze', [T('C', 1)], prev, TEMPLATE, STANDINGS,
    )
    expect(result.winners.bronze).toBe(T('C', 1))
  })
})

describe('mapRoundWinnersToBracketAnswer — empty selection clears the round', () => {
  it('with [] selected, removes any previous winners for that round', () => {
    const prev: BracketProgressionAnswer = {
      winners: { l32_m1: T('A', 1), l32_m2: T('C', 1), l16_m1: T('A', 1) },
    }
    const result = mapRoundWinnersToBracketAnswer(
      'last_32', [], prev, TEMPLATE, STANDINGS,
    )
    expect(result.winners.l32_m1).toBeUndefined()
    expect(result.winners.l32_m2).toBeUndefined()
    // Other rounds untouched
    expect(result.winners.l16_m1).toBe(T('A', 1))
  })
})
