import { describe, it, expect } from 'vitest'
import {
  parseBracketProgressionAnswer,
  validateBracketProgressionOptions,
  resolveSlot,
  deriveBracket,
  validateBracketProgressionAnswer,
  scoreBracketProgression,
  computeBracketCompletion,
  findDownstreamMatches,
  type BracketContext,
} from '../src/services/bracket-progression.service.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionCorrectAnswer,
  BracketProgressionOptions,
} from '../src/types/index.js'

// Compact bracket for unit tests: 2 last_32 → 1 last_16, no QF/SF, fake final/bronze.
const TINY_TEMPLATE: readonly BracketMatch[] = [
  { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: 'l16_m1' },
  { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: '3rd_ABCDF', winnerTo: 'l16_m1' },
  { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
  { id: 'final', round: 'final', slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
]

const TINY_OPTIONS: BracketProgressionOptions = { bracketTemplate: { matches: TINY_TEMPLATE } }

const teamId = (g: string, n: number): string => `${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}-0000-0000-0000-00000000000${n}`

// User filled groups A, B, C with 1st/2nd/3rd/4th, plus 8 best3rds.
const FULL_STANDINGS: AllGroupsStandingAnswer = {
  groups: {
    A: [teamId('A', 1), teamId('A', 2), teamId('A', 3), teamId('A', 4)],
    B: [teamId('B', 1), teamId('B', 2), teamId('B', 3), teamId('B', 4)],
    C: [teamId('C', 1), teamId('C', 2), teamId('C', 3), teamId('C', 4)],
    D: [teamId('D', 1), teamId('D', 2), teamId('D', 3), teamId('D', 4)],
    E: [teamId('E', 1), teamId('E', 2), teamId('E', 3), teamId('E', 4)],
    F: [teamId('F', 1), teamId('F', 2), teamId('F', 3), teamId('F', 4)],
    G: [teamId('G', 1), teamId('G', 2), teamId('G', 3), teamId('G', 4)],
    H: [teamId('H', 1), teamId('H', 2), teamId('H', 3), teamId('H', 4)],
  },
  // Use a known Annex C combo: ABCDEFGH (option 495 in PDF order).
  // best3rds order is irrelevant — Annex C maps by qualifying group set, not order.
  best3rds: [teamId('A', 3), teamId('B', 3), teamId('C', 3), teamId('D', 3), teamId('E', 3), teamId('F', 3), teamId('G', 3), teamId('H', 3)],
}

describe('parseBracketProgressionAnswer', () => {
  it('parses a valid sparse winners map', () => {
    const json = JSON.stringify({ winners: { l32_m1: teamId('A', 1) } })
    expect(parseBracketProgressionAnswer(json)).toEqual({ winners: { l32_m1: teamId('A', 1) } })
  })

  it('returns null on malformed JSON', () => {
    expect(parseBracketProgressionAnswer('{nope')).toBeNull()
  })

  it('returns null when winners is missing', () => {
    expect(parseBracketProgressionAnswer('{}')).toBeNull()
  })

  it('returns null when winners is not an object', () => {
    expect(parseBracketProgressionAnswer('{"winners":[]}')).toBeNull()
  })

  it('returns null when a winner value is not a string', () => {
    expect(parseBracketProgressionAnswer('{"winners":{"l32_m1":123}}')).toBeNull()
  })

  it('accepts an empty winners map (sparse start)', () => {
    expect(parseBracketProgressionAnswer('{"winners":{}}')).toEqual({ winners: {} })
  })
})

describe('validateBracketProgressionOptions', () => {
  it('accepts a valid options object', () => {
    expect(validateBracketProgressionOptions(TINY_OPTIONS)).toEqual(TINY_OPTIONS)
  })

  it('rejects null', () => {
    expect(validateBracketProgressionOptions(null)).toBeNull()
  })

  it('rejects when bracketTemplate is missing', () => {
    expect(validateBracketProgressionOptions({})).toBeNull()
  })

  it('rejects when matches is not an array', () => {
    expect(validateBracketProgressionOptions({ bracketTemplate: { matches: 'oops' } })).toBeNull()
  })

  it('rejects when a match entry is missing required fields', () => {
    expect(validateBracketProgressionOptions({
      bracketTemplate: { matches: [{ id: 'x', round: 'last_32' }] },
    })).toBeNull()
  })
})

describe('resolveSlot', () => {
  const ctx: BracketContext = {
    groupStandings: FULL_STANDINGS,
    bracketTemplate: { matches: TINY_TEMPLATE },
  }

  it('resolves W_A1 to group A 1st place', () => {
    expect(resolveSlot('W_A1', ctx, {})).toBe(teamId('A', 1))
  })

  it('resolves RU_B1 to group B 2nd place', () => {
    expect(resolveSlot('RU_B1', ctx, {})).toBe(teamId('B', 2))
  })

  it('resolves <l32_m1> to the picked winner', () => {
    expect(resolveSlot('<l32_m1>', ctx, { l32_m1: teamId('A', 1) })).toBe(teamId('A', 1))
  })

  it('returns null when upstream winner not yet picked', () => {
    expect(resolveSlot('<l32_m1>', ctx, {})).toBeNull()
  })

  it('returns null when groupStandings is null', () => {
    expect(resolveSlot('W_A1', { ...ctx, groupStandings: null }, {})).toBeNull()
  })

  it('resolves <matchId_loser> when upstream pair is fully derived', () => {
    // l32_m1 winner = A1, so loser must be the other team in the match (B2 from RU_B1)
    expect(resolveSlot('<l32_m1_loser>', ctx, { l32_m1: teamId('A', 1) })).toBe(teamId('B', 2))
  })

  it('returns null when 3rd_ slot has unresolvable Annex C combo', () => {
    // best3rds set ABCDEFGH gives 1A → group E in Annex C; verify that "3rd_<combo>" maps via Annex C.
    // Only 8 of 12 groups qualify; combo specifies 5 candidate groups.
    // Since groupStandings has 8 groups (A-H) and Annex C row "ABCDEFGH" → 1A: E,
    // the 3rd_<combo> resolution depends on bracketTemplate's slot owner (winner of which group A).
    // Here we just check that an unknown combo returns null.
    expect(resolveSlot('3rd_XXXXX', ctx, {})).toBeNull()
  })
})

describe('deriveBracket', () => {
  it('returns all matches locked when groupStandings is null', () => {
    const derived = deriveBracket(TINY_TEMPLATE, null, {})
    for (const m of derived.matches) {
      expect(m.isLocked).toBe(true)
    }
  })

  it('resolves Last 32 teams when groupStandings is filled', () => {
    const derived = deriveBracket(TINY_TEMPLATE, FULL_STANDINGS, {})
    const m1 = derived.matches.find(m => m.id === 'l32_m1')!
    expect(m1.teamA).toBe(teamId('A', 1))
    expect(m1.teamB).toBe(teamId('B', 2))
    expect(m1.isLocked).toBe(false)
  })

  it('cascades winners into Last 16', () => {
    const derived = deriveBracket(TINY_TEMPLATE, FULL_STANDINGS, {
      l32_m1: teamId('A', 1),
      l32_m2: teamId('C', 1),
    })
    const l16 = derived.matches.find(m => m.id === 'l16_m1')!
    expect(l16.teamA).toBe(teamId('A', 1))
    expect(l16.teamB).toBe(teamId('C', 1))
    expect(l16.isLocked).toBe(false)
  })

  it('locks Last 16 when an upstream winner is missing', () => {
    const derived = deriveBracket(TINY_TEMPLATE, FULL_STANDINGS, { l32_m1: teamId('A', 1) })
    const l16 = derived.matches.find(m => m.id === 'l16_m1')!
    expect(l16.teamA).toBe(teamId('A', 1))
    expect(l16.teamB).toBeNull()
    expect(l16.isLocked).toBe(true)
  })
})

describe('validateBracketProgressionAnswer', () => {
  it('accepts a sparse partial answer', () => {
    const result = validateBracketProgressionAnswer(
      { winners: { l32_m1: teamId('A', 1) } },
      TINY_OPTIONS,
      FULL_STANDINGS,
    )
    expect('error' in result).toBe(false)
  })

  it('rejects an unknown match id', () => {
    const result = validateBracketProgressionAnswer(
      { winners: { foo_m99: teamId('A', 1) } },
      TINY_OPTIONS,
      FULL_STANDINGS,
    )
    expect(result).toEqual({ error: 'unknown_match:foo_m99' })
  })

  it('rejects a winner not in the match pair', () => {
    const result = validateBracketProgressionAnswer(
      { winners: { l32_m1: teamId('Z', 9) } },
      TINY_OPTIONS,
      FULL_STANDINGS,
    )
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/^team_not_in_match/)
  })

  it('rejects orphan downstream pick (winner not in derived pair)', () => {
    const result = validateBracketProgressionAnswer(
      { winners: { l32_m1: teamId('A', 1), l32_m2: teamId('C', 1), l16_m1: teamId('B', 2) } },
      TINY_OPTIONS,
      FULL_STANDINGS,
    )
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toMatch(/^team_not_in_match:l16_m1/)
  })
})

describe('computeBracketCompletion', () => {
  it('counts picks per round', () => {
    const c = computeBracketCompletion(
      { winners: { l32_m1: teamId('A', 1), l16_m1: teamId('A', 1) } },
      TINY_TEMPLATE,
    )
    expect(c.totalDone).toBe(2)
    expect(c.totalSteps).toBe(4)
    expect(c.picksByRound.last_32).toEqual({ done: 1, total: 2 })
    expect(c.picksByRound.last_16).toEqual({ done: 1, total: 1 })
    expect(c.picksByRound.final).toEqual({ done: 0, total: 1 })
  })
})

describe('findDownstreamMatches', () => {
  it('lists all matches that depend on a given match', () => {
    expect(findDownstreamMatches('l32_m1', TINY_TEMPLATE).sort()).toEqual(['final', 'l16_m1'])
  })

  it('returns empty for a terminal match', () => {
    expect(findDownstreamMatches('final', TINY_TEMPLATE)).toEqual([])
  })
})

describe('scoreBracketProgression', () => {
  // Use a deterministic mini-template that does NOT rely on Annex C 3rd-place resolution
  // (the production template references `3rd_<COMBO>` slots which require all 8 best3rds
  // for slot resolution). For scoring tests, plain W_/RU_ slot codes are sufficient.
  const SCORE_TEMPLATE: readonly BracketMatch[] = [
    { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: 'l16_m1' },
    { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'RU_D1', winnerTo: 'l16_m1' },
    { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
    { id: 'final', round: 'final', slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
  ]
  // Score-side standings (no best3rds needed since SCORE_TEMPLATE has no `3rd_` slots).
  const SCORE_STANDINGS: AllGroupsStandingAnswer = {
    groups: {
      A: [teamId('A', 1), teamId('A', 2), teamId('A', 3), teamId('A', 4)],
      B: [teamId('B', 1), teamId('B', 2), teamId('B', 3), teamId('B', 4)],
      C: [teamId('C', 1), teamId('C', 2), teamId('C', 3), teamId('C', 4)],
      D: [teamId('D', 1), teamId('D', 2), teamId('D', 3), teamId('D', 4)],
    },
    best3rds: [],
  }

  it('returns 0 when both standings are null', () => {
    expect(scoreBracketProgression(
      { winners: {} },
      { winners: {} },
      SCORE_TEMPLATE,
      null,
      null,
    )).toBe(0)
  })

  it('awards full points for an exact match across every round', () => {
    const winners = {
      l32_m1: teamId('A', 1),
      l32_m2: teamId('C', 1),
      l16_m1: teamId('A', 1),
      final: teamId('A', 1),
    }
    // last_32 participants (slotA+slotB, 4 teams): {A1, B2, C1, D2} → 4 × 2 = 8
    // last_16 participants (last_32 winners): {A1, C1} → 2 × 3 = 6
    // last_8  participants (last_16 winners): {A1}     → 1 × 4 = 4
    // last_4  participants (qf winners):       {}      → 0
    // final   participants (sf winners):       {}      → 0
    // champion (final-match winner):           A1      → +10
    // total: 8 + 6 + 4 + 0 + 0 + 10 = 28
    const result = scoreBracketProgression(
      { winners },
      { winners },
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      SCORE_STANDINGS,
    )
    expect(result).toBe(28)
  })

  it('scores set-wise — order does not matter, only membership', () => {
    // User picks B2 in m1 instead of A1, but both pick C1 in m2.
    // last_32 participant set is identical on both sides (derived from group standings).
    // last_16 winners differ: user {B2, C1}, correct {A1, C1} → intersect = {C1} → 1 × 3 = 3.
    const userWinners = {
      l32_m1: teamId('B', 2),
      l32_m2: teamId('C', 1),
    }
    const correctWinners = {
      l32_m1: teamId('A', 1),
      l32_m2: teamId('C', 1),
    }
    const result = scoreBracketProgression(
      { winners: userWinners },
      { winners: correctWinners },
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      SCORE_STANDINGS,
    )
    // last_32 set: 4 × 2 = 8
    // last_16 set (= last_32 winners): {B2, C1} ∩ {A1, C1} = {C1} → 1 × 3 = 3
    // last_8  set (= last_16 winners, but no l16 winners picked): 0
    // total: 8 + 3 = 11
    expect(result).toBe(11)
  })

  it('returns 0 when no team in any round matches', () => {
    const fullyDifferent: AllGroupsStandingAnswer = {
      groups: {
        A: [teamId('Z', 1), teamId('Z', 2), teamId('Z', 3), teamId('Z', 4)],
        B: [teamId('Y', 1), teamId('Y', 2), teamId('Y', 3), teamId('Y', 4)],
        C: [teamId('X', 1), teamId('X', 2), teamId('X', 3), teamId('X', 4)],
        D: [teamId('W', 1), teamId('W', 2), teamId('W', 3), teamId('W', 4)],
      },
      best3rds: [],
    }
    const result = scoreBracketProgression(
      { winners: { l32_m1: teamId('Z', 1) } },
      { winners: { l32_m1: teamId('A', 1) } },
      SCORE_TEMPLATE,
      fullyDifferent,
      SCORE_STANDINGS,
    )
    expect(result).toBe(0)
  })

  it('scores partial last_32 hits proportionally (3/4 → 6p)', () => {
    // User changes only W_A1 to Z1 → last_32 set differs by exactly 1 team.
    const userStandings: AllGroupsStandingAnswer = {
      ...SCORE_STANDINGS,
      groups: {
        ...SCORE_STANDINGS.groups,
        A: [teamId('Z', 1), teamId('A', 2), teamId('A', 3), teamId('A', 4)],
      },
    }
    const result = scoreBracketProgression(
      { winners: {} },
      { winners: {} },
      SCORE_TEMPLATE,
      userStandings,
      SCORE_STANDINGS,
    )
    // user last_32 set = {Z1, B2, C1, D2}, correct = {A1, B2, C1, D2}, intersect = 3 → 6
    expect(result).toBe(6)
  })

  it('awards champion 10 only when final winner exactly matches', () => {
    const winners = {
      l32_m1: teamId('A', 1),
      l32_m2: teamId('C', 1),
      l16_m1: teamId('A', 1),
      final: teamId('A', 1),
    }
    const wrongFinal = { ...winners, final: teamId('C', 1) }
    const right = scoreBracketProgression(
      { winners },
      { winners },
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      SCORE_STANDINGS,
    )
    const wrong = scoreBracketProgression(
      { winners: wrongFinal },
      { winners },
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      SCORE_STANDINGS,
    )
    // final-match-WINNER (champion): right = A1 (matches correct), wrong = C1 (no match).
    // The `final` round participant SET is the same for both (same l16 winner → A1) → cancels out.
    // Net: right gets +10 champion bonus, wrong does not.
    expect(right - wrong).toBe(10)
  })
})

describe('scoreBracketProgression — new participants-shape correctAnswer (UX-044)', () => {
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

  it('scores against the new participants-shape correct answer', () => {
    // User picks the canonical winners. Admin participants directly express the same sets.
    const userWinners = {
      l32_m1: teamId('A', 1),
      l32_m2: teamId('C', 1),
      l16_m1: teamId('A', 1),
      final: teamId('A', 1),
    }
    const correctAnswer: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [teamId('A', 1), teamId('B', 2), teamId('C', 1), teamId('D', 2)],
        last_16: [teamId('A', 1), teamId('C', 1)],
        qf: [teamId('A', 1)],
        sf: [],
        final: [],
      },
      champion: teamId('A', 1),
      bronzeWinner: null,
    }
    // User derived sets:
    //   l32 participants = {A1, B2, C1, D2} → 4 × 2 = 8
    //   l32 winners      = {A1, C1}         → ∩ admin.last_16 (= {A1, C1}) → 2 × 3 = 6
    //   l16 winners      = {A1}             → ∩ admin.qf (= {A1})         → 1 × 4 = 4
    //   qf winners       = {}                → 0
    //   sf winners       = {}                → 0
    //   champion (final winner = A1) === correct.champion → +10
    //   total = 8 + 6 + 4 + 10 = 28
    const result = scoreBracketProgression(
      { winners: userWinners },
      correctAnswer,
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      null, // correctGroupStandings unused for new shape
    )
    expect(result).toBe(28)
  })

  it('produces the same score as legacy shape for an equivalent admin tip', () => {
    const userWinners = {
      l32_m1: teamId('A', 1),
      l32_m2: teamId('C', 1),
      l16_m1: teamId('A', 1),
      final: teamId('A', 1),
    }
    const legacy = scoreBracketProgression(
      { winners: userWinners },
      { winners: userWinners },
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      SCORE_STANDINGS,
    )
    const newShape: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [teamId('A', 1), teamId('B', 2), teamId('C', 1), teamId('D', 2)],
        last_16: [teamId('A', 1), teamId('C', 1)],
        qf: [teamId('A', 1)],
        sf: [],
        final: [],
      },
      champion: teamId('A', 1),
      bronzeWinner: null,
    }
    const nu = scoreBracketProgression(
      { winners: userWinners },
      newShape,
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      null,
    )
    expect(nu).toBe(legacy)
  })

  it('awards 0 champion when admin.champion is null', () => {
    const userWinners = { l32_m1: teamId('A', 1), l32_m2: teamId('C', 1), l16_m1: teamId('A', 1), final: teamId('A', 1) }
    const correctAnswer: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [teamId('A', 1), teamId('B', 2), teamId('C', 1), teamId('D', 2)],
        last_16: [teamId('A', 1), teamId('C', 1)],
        qf: [teamId('A', 1)],
        sf: [],
        final: [],
      },
      champion: null,
      bronzeWinner: null,
    }
    const result = scoreBracketProgression(
      { winners: userWinners },
      correctAnswer,
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      null,
    )
    // l32 (8) + l16 (6) + qf (4) — no champion bonus
    expect(result).toBe(18)
  })

  it('zero intersection → zero points', () => {
    const userWinners = { l32_m1: teamId('A', 1), l32_m2: teamId('C', 1) }
    const correctAnswer: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: [teamId('Z', 1), teamId('Z', 2), teamId('Z', 3), teamId('Z', 4)],
        last_16: [],
        qf: [],
        sf: [],
        final: [],
      },
      champion: null,
      bronzeWinner: null,
    }
    const result = scoreBracketProgression(
      { winners: userWinners },
      correctAnswer,
      SCORE_TEMPLATE,
      SCORE_STANDINGS,
      null,
    )
    expect(result).toBe(0)
  })
})
