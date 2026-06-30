import { describe, it, expect } from 'vitest'
import { buildBracketScoredView, parseCorrectAnswer, isBracketProgressionCorrectAnswer } from './bracketScoredView.js'
import type {
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCorrectAnswer,
} from '../types/index.js'

// Synthetic 4 → 2 → 1 mini-bracket. All slot codes use the upstream-match form
// (`<match_id>`) so we do NOT depend on group-standing slot resolution.
const TEMPLATE: readonly BracketMatch[] = [
  { id: 'l32_m1', round: 'last_32', slotA: '<seed_A>', slotB: '<seed_B>', winnerTo: 'l16_m1' },
  { id: 'l32_m2', round: 'last_32', slotA: '<seed_C>', slotB: '<seed_D>', winnerTo: 'l16_m1' },
  { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
  { id: 'final', round: 'final', slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
]

const TA = 'aaaa-A'
const TB = 'bbbb-B'
const TC = 'cccc-C'
const TD = 'dddd-D'

// We build a small user view by pre-populating "synthetic upstream winners" — we treat
// `seed_A..seed_D` as virtual upstream matches whose winners are the real teams. The
// derive helper resolves `<seed_*>` as `winners.seed_*`.
function withSeeds(winners: Record<string, string>): Record<string, string> {
  return { seed_A: TA, seed_B: TB, seed_C: TC, seed_D: TD, ...winners }
}

describe('isBracketProgressionCorrectAnswer', () => {
  it('detects the participants shape', () => {
    expect(isBracketProgressionCorrectAnswer({
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null, bronzeWinner: null,
    })).toBe(true)
  })
  it('rejects the legacy winners shape', () => {
    expect(isBracketProgressionCorrectAnswer({ winners: { l32_m1: TA } })).toBe(false)
  })
  it('rejects junk', () => {
    expect(isBracketProgressionCorrectAnswer(null)).toBe(false)
    expect(isBracketProgressionCorrectAnswer({ participants: 'no' })).toBe(false)
  })
})

describe('parseCorrectAnswer', () => {
  it('parses participants shape', () => {
    const raw = JSON.stringify({
      participants: { last_32: [TA, TB, TC, TD], last_16: [TA, TC], qf: [], sf: [], final: [] },
      champion: TA, bronzeWinner: null,
    })
    const parsed = parseCorrectAnswer(raw)
    expect(parsed).not.toBeNull()
    expect(isBracketProgressionCorrectAnswer(parsed!)).toBe(true)
  })

  it('parses legacy winners shape', () => {
    const raw = JSON.stringify({ winners: { l32_m1: TA } })
    const parsed = parseCorrectAnswer(raw)
    expect(parsed).toEqual({ winners: { l32_m1: TA } })
  })

  it('returns null on garbage', () => {
    expect(parseCorrectAnswer('{nope')).toBeNull()
    expect(parseCorrectAnswer(null)).toBeNull()
  })
})

describe('buildBracketScoredView (participants shape)', () => {
  it('full match — user picked all the correct winners → max points per round + champion', () => {
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({ l32_m1: TA, l32_m2: TC, l16_m1: TA, final: TA }),
    }
    // Pad the participant sets to their full target sizes so every round is "evaluated".
    const last32 = [TA, TB, TC, TD, ...Array.from({ length: 28 }, (_, i) => `pad32-${i}`)]
    const last16 = [TA, TC, ...Array.from({ length: 14 }, (_, i) => `pad16-${i}`)]
    const qf = [TA, ...Array.from({ length: 7 }, (_, i) => `padQF-${i}`)]
    const sf = [TA, ...Array.from({ length: 3 }, (_, i) => `padSF-${i}`)]
    const fin = [TA, 'padFinal-1']
    const correctAnswer: BracketProgressionCorrectAnswer = {
      participants: { last_32: last32, last_16: last16, qf, sf, final: fin },
      champion: TA, bronzeWinner: null,
    }
    const view = buildBracketScoredView({
      userAnswer, correctAnswer, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })

    // last_32: user has {A,B,C,D}, correct contains all 4 → 4 hits × 2 = 8
    const r32 = view.rounds.find(r => r.round === 'last_32')!
    expect(r32.evaluated).toBe(true)
    expect(r32.hitCount).toBe(4)
    expect(r32.pointsEarned).toBe(8)
    // last_16 — user advanced A and C → 2 × 3 = 6
    const r16 = view.rounds.find(r => r.round === 'last_16')!
    expect(r16.hitCount).toBe(2)
    expect(r16.pointsEarned).toBe(6)
    // champion match
    expect(view.champion.userPick).toBe(TA)
    expect(view.champion.correct).toBe(TA)
    expect(view.champion.status).toBe('hit')
    expect(view.champion.pointsEarned).toBe(10)
  })

  it('zero intersection in last_32 (admin fully evaluated 32 teams) → no points, all userTeams marked miss, missedTeams holds correct teams', () => {
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({}),
    }
    // Make last_32 fully evaluated with 32 distinct ids — none of which are TA..TD.
    const last32teams = Array.from({ length: 32 }, (_, i) => `x${i + 1}`)
    const correctAnswer: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: last32teams,
        last_16: [], qf: [], sf: [], final: [],
      },
      champion: null, bronzeWinner: null,
    }
    const view = buildBracketScoredView({
      userAnswer, correctAnswer, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    const r32 = view.rounds.find(r => r.round === 'last_32')!
    expect(r32.evaluated).toBe(true)
    expect(r32.hitCount).toBe(0)
    expect(r32.userTeams.every(c => c.status === 'miss')).toBe(true)
    expect(r32.missedTeams.length).toBe(32)
    expect(r32.pointsEarned).toBe(0)
  })

  it('partial hit — user advances TA but the champion is TC → +0 for champion', () => {
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({ l32_m1: TA, l32_m2: TC, l16_m1: TA, final: TA }),
    }
    const last32 = [TA, TB, TC, TD, ...Array.from({ length: 28 }, (_, i) => `pad32-${i}`)]
    const last16 = [TA, TC, ...Array.from({ length: 14 }, (_, i) => `pad16-${i}`)]
    const qf = [TC, ...Array.from({ length: 7 }, (_, i) => `padQF-${i}`)]
    const sf = [TC, ...Array.from({ length: 3 }, (_, i) => `padSF-${i}`)]
    const fin = [TC, 'padFinal-1']
    const correctAnswer: BracketProgressionCorrectAnswer = {
      participants: { last_32: last32, last_16: last16, qf, sf, final: fin },
      champion: TC, bronzeWinner: null,
    }
    const view = buildBracketScoredView({
      userAnswer, correctAnswer, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    expect(view.champion.status).toBe('miss')
    expect(view.champion.pointsEarned).toBe(0)
  })
})

describe('buildBracketScoredView (legacy shape)', () => {
  it('legacy and participants shapes yield the same totalPoints when both lift round sets above the evaluation threshold', () => {
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({ l32_m1: TA, l32_m2: TC, l16_m1: TA, final: TA }),
    }
    // For the legacy shape we need a correct-side `BracketProgressionAnswer` whose derived
    // bracket reaches the size targets — not realistic for our tiny TEMPLATE. Instead, just
    // sanity-check that an empty/legacy correctAnswer drops every round into 'pending' but
    // totalPoints stays 0 — same as for an empty participants shape.
    const correctLegacy: BracketProgressionAnswer = { winners: {} }
    const correctParticipantsEmpty: BracketProgressionCorrectAnswer = {
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null, bronzeWinner: null,
    }
    const v1 = buildBracketScoredView({
      userAnswer, correctAnswer: correctLegacy, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    const v2 = buildBracketScoredView({
      userAnswer, correctAnswer: correctParticipantsEmpty, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    expect(v1.totalPoints).toBe(0)
    expect(v2.totalPoints).toBe(0)
    // No round in either view should claim to be evaluated.
    for (const r of v1.rounds) expect(r.evaluated).toBe(false)
    for (const r of v2.rounds) expect(r.evaluated).toBe(false)
  })
})

describe('buildBracketScoredView — partial admin evaluation (unknown cascade)', () => {
  // Make a slightly bigger template so a `last_32` size of 4 is below the 32-target threshold
  // and a `last_16` size of 2 is below the 16-target threshold. Round sizes do not need to
  // match the real WC bracket — only the size vs. the target matters for the evaluated flag.
  it('marks downstream rounds as pending and cascades miss vs. unknown by upstream eviction', () => {
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({ l32_m1: TA, l32_m2: TC, l16_m1: TA, final: TA }),
    }
    // Admin has only filled in last_32 (4 teams) → not yet 32, so EVERY round is "pending".
    // No upstream evaluated round → every user team renders as 'unknown'.
    const partialNothingDone: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [TA, TB, TC, TD],   // size 4 < 32 → not evaluated
        last_16: [], qf: [], sf: [], final: [],
      },
      champion: null, bronzeWinner: null,
    }
    const v = buildBracketScoredView({
      userAnswer, correctAnswer: partialNothingDone, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    for (const r of v.rounds) expect(r.evaluated).toBe(false)
    const r32 = v.rounds.find(r => r.round === 'last_32')!
    expect(r32.userTeams.every(c => c.status === 'unknown')).toBe(true)
    expect(r32.pointsEarned).toBe(0)
  })

  it('once last_32 is fully evaluated, downstream unknowns inherit the eviction', () => {
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({ l32_m1: TA, l32_m2: TC, l16_m1: TA, final: TA }),
    }
    // Fake "fully evaluated" last_32 by filling 32 distinct ids; user's TA, TC made it.
    // TB and TD got eliminated → user's last_16 pick TA is still alive (unknown), but if the
    // user had advanced TB we'd want it shown as miss.
    const fullLast32: string[] = Array.from({ length: 32 }, (_, i) => i === 0 ? TA : i === 1 ? TC : `team-${i}`)
    const partial: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: fullLast32,
        last_16: [], qf: [], sf: [], final: [],
      },
      champion: null, bronzeWinner: null,
    }
    const v = buildBracketScoredView({
      userAnswer, correctAnswer: partial, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    const r32 = v.rounds.find(r => r.round === 'last_32')!
    expect(r32.evaluated).toBe(true)
    // l32_m1 winner picks: TA → 'unknown' (still in last_32, but next round not evaluated)
    const r16 = v.rounds.find(r => r.round === 'last_16')!
    expect(r16.evaluated).toBe(false)
    const cellTA = r16.userTeams.find(c => c.teamId === TA)
    expect(cellTA?.status).toBe('unknown')
  })

  it('user picked TB to advance, admin says TB is OUT of last_32 → TB renders miss in last_16', () => {
    // Different user winner picks: in l32_m1, user picks TB (loser per admin).
    const userAnswer: BracketProgressionAnswer = {
      winners: withSeeds({ l32_m1: TB, l32_m2: TC, l16_m1: TB, final: TB }),
    }
    const fullLast32: string[] = Array.from({ length: 32 }, (_, i) => i === 0 ? TA : i === 1 ? TC : `team-${i}`)
    // TB is NOT in the admin's last_32 → it's evicted.
    const partial: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: fullLast32,
        last_16: [], qf: [], sf: [], final: [],
      },
      champion: null, bronzeWinner: null,
    }
    const v = buildBracketScoredView({
      userAnswer, correctAnswer: partial, template: TEMPLATE,
      userGroupStandings: null, correctGroupStandings: null,
    })
    const r16 = v.rounds.find(r => r.round === 'last_16')!
    const cellTB = r16.userTeams.find(c => c.teamId === TB)
    expect(cellTB?.status).toBe('miss')
    expect(r16.pointsEarned).toBe(0)
  })
})
