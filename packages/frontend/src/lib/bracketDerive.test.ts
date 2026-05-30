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
} from './bracketDerive.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionOptions,
} from '../types/index.js'

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
  it('returns 0 (placeholder until pointing story)', () => {
    expect(scoreBracketProgression(
      { winners: { l32_m1: teamId('A', 1) } },
      { winners: { l32_m1: teamId('A', 1) } },
      0,
    )).toBe(0)
  })
})
