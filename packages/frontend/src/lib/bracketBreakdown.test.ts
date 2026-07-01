import { describe, it, expect } from 'vitest'
import {
  computeBracketBreakdown,
  teamStatusForRound,
  type BracketRoundKey,
} from './bracketBreakdown.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCorrectAnswer,
} from '../types/index.js'

// Minimal 5-round toy template covering last_32 → last_16 → qf → sf → final.
// Groups A..P give us 16 first-place slots, feeding 8 last_32 matches (16 teams). Winners cascade
// through 4 last_16 → 2 qf → 1 sf → 1 final. The sf/final "pair" is artificial (final grabs the sf
// winner twice via `<sf_m1>`) — we only need it to exercise the set-intersection scoring; the
// per-round set logic doesn't care that the same team appears on both slots.
const TOY_TEMPLATE: readonly BracketMatch[] = [
  { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'W_B1', winnerTo: 'l16_m1' },
  { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'W_D1', winnerTo: 'l16_m1' },
  { id: 'l32_m3', round: 'last_32', slotA: 'W_E1', slotB: 'W_F1', winnerTo: 'l16_m2' },
  { id: 'l32_m4', round: 'last_32', slotA: 'W_G1', slotB: 'W_H1', winnerTo: 'l16_m2' },
  { id: 'l32_m5', round: 'last_32', slotA: 'W_I1', slotB: 'W_J1', winnerTo: 'l16_m3' },
  { id: 'l32_m6', round: 'last_32', slotA: 'W_K1', slotB: 'W_L1', winnerTo: 'l16_m3' },
  { id: 'l32_m7', round: 'last_32', slotA: 'W_M1', slotB: 'W_N1', winnerTo: 'l16_m4' },
  { id: 'l32_m8', round: 'last_32', slotA: 'W_O1', slotB: 'W_P1', winnerTo: 'l16_m4' },
  { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'qf_m1' },
  { id: 'l16_m2', round: 'last_16', slotA: '<l32_m3>', slotB: '<l32_m4>', winnerTo: 'qf_m1' },
  { id: 'l16_m3', round: 'last_16', slotA: '<l32_m5>', slotB: '<l32_m6>', winnerTo: 'qf_m2' },
  { id: 'l16_m4', round: 'last_16', slotA: '<l32_m7>', slotB: '<l32_m8>', winnerTo: 'qf_m2' },
  { id: 'qf_m1', round: 'qf', slotA: '<l16_m1>', slotB: '<l16_m2>', winnerTo: 'sf_m1' },
  { id: 'qf_m2', round: 'qf', slotA: '<l16_m3>', slotB: '<l16_m4>', winnerTo: 'sf_m1' },
  { id: 'sf_m1', round: 'sf', slotA: '<qf_m1>', slotB: '<qf_m2>', winnerTo: 'final' },
  { id: 'final', round: 'final', slotA: '<sf_m1>', slotB: '<sf_m1>', winnerTo: null },
]

function standings(map: Record<string, [string, string]>): AllGroupsStandingAnswer {
  const groups: Record<string, readonly (string | null)[]> = {}
  for (const [code, [first, second]] of Object.entries(map)) {
    groups[code] = [first, second, null, null]
  }
  return { groups, best3rds: [] }
}

const GS: AllGroupsStandingAnswer = standings({
  A: ['tA1', 'tA2'], B: ['tB1', 'tB2'], C: ['tC1', 'tC2'], D: ['tD1', 'tD2'],
  E: ['tE1', 'tE2'], F: ['tF1', 'tF2'], G: ['tG1', 'tG2'], H: ['tH1', 'tH2'],
  I: ['tI1', 'tI2'], J: ['tJ1', 'tJ2'], K: ['tK1', 'tK2'], L: ['tL1', 'tL2'],
  M: ['tM1', 'tM2'], N: ['tN1', 'tN2'], O: ['tO1', 'tO2'], P: ['tP1', 'tP2'],
})

describe('teamStatusForRound', () => {
  const correct: BracketProgressionCorrectAnswer = {
    participants: {
      last_32: ['tA1', 'tB1', 'tC1', 'tD1', 'tE1', 'tF1', 'tG1', 'tH1'],
      last_16: ['tA1', 'tC1', 'tE1', 'tG1'],
      qf: [],
      sf: [],
      final: ['tA1', 'tE1'],
    },
    champion: 'tA1',
    bronzeWinner: null,
  }
  it('returns "correct" when the team is in the round participants set', () => {
    expect(teamStatusForRound('tA1', 'last_32', correct)).toBe('correct')
    expect(teamStatusForRound('tA1', 'final', correct)).toBe('correct')
  })

  it('returns "wrong" when the team is not in the round participants set', () => {
    expect(teamStatusForRound('tA2', 'last_32', correct)).toBe('wrong')
    expect(teamStatusForRound('tB1', 'last_16', correct)).toBe('wrong')
  })

  it('returns "pending" when the round has no participants configured yet', () => {
    expect(teamStatusForRound('tA1', 'qf', correct)).toBe('pending')
    expect(teamStatusForRound('tB1', 'sf', correct)).toBe('pending')
  })

  it('returns "pending" for the bronze round (never a participants-shape entry)', () => {
    expect(teamStatusForRound('tA1', 'bronze', correct)).toBe('pending')
  })

  it('returns "pending" when teamId is null', () => {
    expect(teamStatusForRound(null, 'last_32', correct)).toBe('pending')
  })
})

describe('computeBracketBreakdown', () => {
  it('scores each round via set intersection and awards champion points', () => {
    // User picks: first team wins every l32 match, first bracket winner cascades through.
    // l32 winners: A1, C1, E1, G1, I1, K1, M1, O1 (8 teams)
    // l16 winners: A1, E1, I1, M1 (4 teams)
    // qf winners: A1, I1
    // sf winner: A1
    // final winner: A1
    const predicted: BracketProgressionAnswer = {
      winners: {
        l32_m1: 'tA1', l32_m2: 'tC1', l32_m3: 'tE1', l32_m4: 'tG1',
        l32_m5: 'tI1', l32_m6: 'tK1', l32_m7: 'tM1', l32_m8: 'tO1',
        l16_m1: 'tA1', l16_m2: 'tE1', l16_m3: 'tI1', l16_m4: 'tM1',
        qf_m1: 'tA1', qf_m2: 'tI1',
        sf_m1: 'tA1',
        final: 'tA1',
      },
    }
    const correct: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: ['tA1', 'tB1', 'tC1', 'tD1', 'tE1', 'tF1', 'tG1', 'tH1',
                  'tI1', 'tJ1', 'tK1', 'tL1', 'tM1', 'tN1', 'tO1', 'tP1'],
        last_16: ['tA1', 'tC1', 'tE1', 'tG1', 'tI1', 'tK1', 'tM1', 'tO1'],
        qf: [],
        sf: [],
        final: ['tA1', 'tI1'],
      },
      champion: 'tA1',
      bronzeWinner: null,
    }

    const result = computeBracketBreakdown(predicted, correct, TOY_TEMPLATE, GS)

    // last_32: user participants set (16 teams from A1..P1) ∩ correct.last_32 (same 16) → 16 × 2p = 32
    expect(result.perRound.last_32).toEqual({ matched: 16, points: 32, pointsPerTeam: 2 })
    // last_16: user winners of l32 (8) ∩ correct.last_16 (same 8) → 8 × 3p = 24
    expect(result.perRound.last_16).toEqual({ matched: 8, points: 24, pointsPerTeam: 3 })
    // qf: correct set empty → matched = 0, pending
    expect(result.perRound.qf).toEqual({ matched: 0, points: 0, pointsPerTeam: 4, pending: true })
    // sf: correct set empty → matched = 0, pending
    expect(result.perRound.sf).toEqual({ matched: 0, points: 0, pointsPerTeam: 6, pending: true })
    // final: user winners of sf = {A1} vs correct.final = {A1, I1} → 1 × 8p = 8
    expect(result.perRound.final).toEqual({ matched: 1, points: 8, pointsPerTeam: 8 })
    // champion hit
    expect(result.championHit).toBe(true)
    expect(result.championPoints).toBe(10)
    // Total: 32 + 24 + 0 + 0 + 8 + 10 = 74
    expect(result.total).toBe(74)
  })

  it('gives 0 champion points when user pick differs', () => {
    const predicted: BracketProgressionAnswer = {
      winners: {
        l32_m1: 'tA1', l32_m2: 'tC1', l32_m3: 'tE1', l32_m4: 'tG1',
        l32_m5: 'tI1', l32_m6: 'tK1', l32_m7: 'tM1', l32_m8: 'tO1',
        l16_m1: 'tA1', l16_m2: 'tE1', l16_m3: 'tI1', l16_m4: 'tM1',
        qf_m1: 'tA1', qf_m2: 'tI1',
        sf_m1: 'tI1',
        final: 'tI1', // <-- user picked I1 as champion
      },
    }
    const correct: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [], last_16: [], qf: [], sf: [], final: [],
      },
      champion: 'tA1', // <-- real champion is A1
      bronzeWinner: null,
    }
    const result = computeBracketBreakdown(predicted, correct, TOY_TEMPLATE, GS)
    expect(result.championHit).toBe(false)
    expect(result.championPoints).toBe(0)
  })

  it('marks a round as "pending" when its participants list is empty', () => {
    const predicted: BracketProgressionAnswer = { winners: { l32_m1: 'tA1' } }
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null, bronzeWinner: null,
    }
    const result = computeBracketBreakdown(predicted, correct, TOY_TEMPLATE, GS)
    expect(result.perRound.last_32.pending).toBe(true)
    expect(result.perRound.last_16.pending).toBe(true)
    expect(result.total).toBe(0)
  })

  it('returns matched=0 when user tipped nothing but correct answer is populated', () => {
    const predicted: BracketProgressionAnswer = { winners: {} }
    const correct: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: ['tA1', 'tB1', 'tC1', 'tD1', 'tE1', 'tF1', 'tG1', 'tH1',
                  'tI1', 'tJ1', 'tK1', 'tL1', 'tM1', 'tN1', 'tO1', 'tP1'],
        last_16: ['tA1', 'tC1', 'tE1', 'tG1'],
        qf: [], sf: [],
        final: ['tA1', 'tE1'],
      },
      champion: 'tA1', bronzeWinner: null,
    }
    const result = computeBracketBreakdown(predicted, correct, TOY_TEMPLATE, GS)
    // With no winners, the derived bracket still has last_32 slot-teams from the group standings.
    // But downstream WINNERS sets are empty because no winner is picked.
    expect(result.perRound.last_16.matched).toBe(0)
    expect(result.perRound.final.matched).toBe(0)
    expect(result.championHit).toBe(false)
  })
})

describe('teamStatusForRound integration with derived rounds', () => {
  it('champion round is tracked separately from participants set', () => {
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: ['tA1', 'tE1'] },
      champion: 'tA1',
      bronzeWinner: null,
    }
    // teamStatusForRound only checks participants sets; champion is separate.
    expect(teamStatusForRound('tA1', 'final', correct)).toBe('correct')
    expect(teamStatusForRound('tE1', 'final', correct)).toBe('correct')
    expect(teamStatusForRound('tB1', 'final', correct)).toBe('wrong')
  })
})

// Sanity: the round-order iteration exposed by the helper.
describe('BracketRound coverage', () => {
  it('perRound covers exactly the five scored rounds', () => {
    const predicted: BracketProgressionAnswer = { winners: {} }
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null, bronzeWinner: null,
    }
    const result = computeBracketBreakdown(predicted, correct, TOY_TEMPLATE, GS)
    const rounds: BracketRoundKey[] = ['last_32', 'last_16', 'qf', 'sf', 'final']
    for (const r of rounds) {
      expect(result.perRound[r]).toBeDefined()
    }
  })
})
