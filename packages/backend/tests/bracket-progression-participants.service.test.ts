import { describe, it, expect } from 'vitest'
import {
  parseBracketProgressionCorrectAnswer,
  scoreBracketProgressionWithParticipants,
} from '../src/services/bracket-progression.service.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionCorrectAnswer,
} from '../src/types/index.js'

const teamId = (g: string, n: number): string =>
  `${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}-0000-0000-0000-00000000000${n}`

const SCORE_TEMPLATE: readonly BracketMatch[] = [
  { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: 'l16_m1' },
  { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'RU_D1', winnerTo: 'l16_m1' },
  { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
  { id: 'final', round: 'final', slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
]

const SCORE_STANDINGS: AllGroupsStandingAnswer = {
  groups: {
    A: [teamId('A', 1), teamId('A', 2), teamId('A', 3), teamId('A', 4)],
    B: [teamId('B', 1), teamId('B', 2), teamId('B', 3), teamId('B', 4)],
    C: [teamId('C', 1), teamId('C', 2), teamId('C', 3), teamId('C', 4)],
    D: [teamId('D', 1), teamId('D', 2), teamId('D', 3), teamId('D', 4)],
  },
  best3rds: [],
}

describe('parseBracketProgressionCorrectAnswer', () => {
  it('parses a valid participants-shape answer', () => {
    const json = JSON.stringify({
      participants: {
        last_32: ['a', 'b'],
        last_16: ['a'],
        qf: [],
        sf: [],
        final: [],
      },
      champion: null,
      bronzeWinner: null,
    })
    const parsed = parseBracketProgressionCorrectAnswer(json)
    expect(parsed).not.toBeNull()
    expect(parsed?.participants.last_32).toEqual(['a', 'b'])
    expect(parsed?.participants.last_16).toEqual(['a'])
  })

  it('returns null on the legacy winners-map shape (so callers fall back)', () => {
    const json = JSON.stringify({ winners: { l32_m1: 'team-x' } })
    expect(parseBracketProgressionCorrectAnswer(json)).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    expect(parseBracketProgressionCorrectAnswer('{nope')).toBeNull()
  })

  it('returns null when participants is missing', () => {
    expect(parseBracketProgressionCorrectAnswer('{"champion":null}')).toBeNull()
  })

  it('returns null when a round is not an array', () => {
    const json = JSON.stringify({
      participants: { last_32: 'oops', last_16: [], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: null,
    })
    expect(parseBracketProgressionCorrectAnswer(json)).toBeNull()
  })

  it('returns null when a round contains a non-string', () => {
    const json = JSON.stringify({
      participants: { last_32: [1, 2], last_16: [], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: null,
    })
    expect(parseBracketProgressionCorrectAnswer(json)).toBeNull()
  })

  it('accepts a string champion and bronzeWinner', () => {
    const json = JSON.stringify({
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: 'team-c',
      bronzeWinner: 'team-b',
    })
    const parsed = parseBracketProgressionCorrectAnswer(json)
    expect(parsed?.champion).toBe('team-c')
    expect(parsed?.bronzeWinner).toBe('team-b')
  })

  it('returns null when champion is not a string or null', () => {
    const json = JSON.stringify({
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: 42,
      bronzeWinner: null,
    })
    expect(parseBracketProgressionCorrectAnswer(json)).toBeNull()
  })
})

describe('scoreBracketProgressionWithParticipants', () => {
  const A1 = teamId('A', 1)
  const B2 = teamId('B', 2)
  const C1 = teamId('C', 1)
  const D2 = teamId('D', 2)

  it('returns 0 when user standings are null', () => {
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [A1, B2, C1, D2], last_16: [A1, C1], qf: [A1], sf: [], final: [] },
      champion: A1,
      bronzeWinner: null,
    }
    const score = scoreBracketProgressionWithParticipants(
      { winners: {} },
      correct,
      SCORE_TEMPLATE,
      null,
    )
    expect(score).toBe(0)
  })

  it('awards full points for an exact match across every round', () => {
    const winners = {
      l32_m1: A1,
      l32_m2: C1,
      l16_m1: A1,
      final: A1,
    }
    const correct: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [A1, B2, C1, D2], // matches the slotA+slotB derivation
        last_16: [A1, C1],          // matches last_32 winners
        qf: [A1],                   // matches last_16 winners
        sf: [],
        final: [],
      },
      champion: A1,
      bronzeWinner: null,
    }
    // last_32: 4 × 2 = 8
    // last_16: 2 × 3 = 6
    // qf:     1 × 4 = 4
    // sf:     0
    // final:  0
    // champion: +10
    // total: 28
    const score = scoreBracketProgressionWithParticipants(
      { winners },
      correct,
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
    )
    expect(score).toBe(28)
  })

  it('partial credit — same last_32 participants but wrong l16 winner', () => {
    // User picks B2 in m1 (correct admin says A1), still picks C1 in m2.
    const winners = {
      l32_m1: B2,
      l32_m2: C1,
      l16_m1: B2,
      final: B2,
    }
    const correct: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [A1, B2, C1, D2], // same as user's derived set → 4 × 2 = 8
        last_16: [A1, C1],          // user has {B2, C1} → intersect {C1} → 1 × 3 = 3
        qf: [A1],                   // user has {B2} → 0
        sf: [],
        final: [],
      },
      champion: A1,                 // user's final winner is B2 → 0
      bronzeWinner: null,
    }
    const score = scoreBracketProgressionWithParticipants(
      { winners },
      correct,
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
    )
    expect(score).toBe(8 + 3)
  })

  it('champion only — no rounds match', () => {
    const winners = { l32_m1: A1, l32_m2: C1, l16_m1: A1, final: A1 }
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: A1,
      bronzeWinner: null,
    }
    expect(scoreBracketProgressionWithParticipants({ winners }, correct, SCORE_TEMPLATE, SCORE_STANDINGS)).toBe(10)
  })

  it('does not score champion when admin pick is null', () => {
    const winners = { l32_m1: A1, l32_m2: C1, l16_m1: A1, final: A1 }
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: null,
    }
    expect(scoreBracketProgressionWithParticipants({ winners }, correct, SCORE_TEMPLATE, SCORE_STANDINGS)).toBe(0)
  })

  it('bronzeWinner does not award points (display-only)', () => {
    const winners = { l32_m1: A1, l32_m2: C1, l16_m1: A1, final: A1 }
    const correct: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: A1,
    }
    expect(scoreBracketProgressionWithParticipants({ winners }, correct, SCORE_TEMPLATE, SCORE_STANDINGS)).toBe(0)
  })
})
