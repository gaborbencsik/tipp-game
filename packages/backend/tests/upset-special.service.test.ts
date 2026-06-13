import { describe, it, expect } from 'vitest'
import {
  scoreUpsetSpecial,
  parseUpsetPicks,
  parseUpsetEliminated,
  validateUpsetOptions,
  resolveUpsetMaxPoints,
  deriveEliminatedFromBracket,
} from '../src/services/upset-special.service.js'
import type { AllGroupsStandingAnswer, BracketMatch, MultiTeamWeightedOptions } from '../src/types/index.js'

const SPAIN = '11111111-2222-3333-4444-aaaaaaaaaaa1'
const FRANCE = '11111111-2222-3333-4444-aaaaaaaaaaa2'
const BRAZIL = '11111111-2222-3333-4444-aaaaaaaaaaa3'
const CANADA = '11111111-2222-3333-4444-aaaaaaaaaaa4'

const CHOICES = [
  { teamId: SPAIN, points: 18 },
  { teamId: FRANCE, points: 17 },
  { teamId: BRAZIL, points: 15 },
  { teamId: CANADA, points: 3 },
]

describe('scoreUpsetSpecial', () => {
  it('awards both teams when both picks were eliminated', () => {
    expect(scoreUpsetSpecial([SPAIN, CANADA], [SPAIN, CANADA], CHOICES)).toBe(21)
  })

  it('awards a single pick when one of two picks was eliminated', () => {
    expect(scoreUpsetSpecial([SPAIN, FRANCE], [SPAIN], CHOICES)).toBe(18)
  })

  it('returns 0 when no pick was eliminated', () => {
    expect(scoreUpsetSpecial([SPAIN, FRANCE], [BRAZIL], CHOICES)).toBe(0)
  })

  it('returns 0 for an empty pick list', () => {
    expect(scoreUpsetSpecial([], [SPAIN, FRANCE], CHOICES)).toBe(0)
  })

  it('ignores picks that are not in the choices table', () => {
    const ALIEN = '11111111-2222-3333-4444-bbbbbbbbbbbb'
    expect(scoreUpsetSpecial([ALIEN, SPAIN], [ALIEN, SPAIN], CHOICES)).toBe(18)
  })

  it('ignores duplicate eliminated team entries', () => {
    expect(scoreUpsetSpecial([SPAIN], [SPAIN, SPAIN], CHOICES)).toBe(18)
  })
})

describe('parseUpsetPicks', () => {
  it('parses a valid 2-pick JSON array', () => {
    expect(parseUpsetPicks(JSON.stringify([SPAIN, FRANCE]))).toEqual([SPAIN, FRANCE])
  })

  it('returns null for malformed JSON', () => {
    expect(parseUpsetPicks('not json')).toBeNull()
  })

  it('returns null for non-array JSON', () => {
    expect(parseUpsetPicks('{"a":1}')).toBeNull()
  })

  it('returns null when array contains non-string entries', () => {
    expect(parseUpsetPicks(JSON.stringify([SPAIN, 42]))).toBeNull()
  })
})

describe('parseUpsetEliminated', () => {
  it('returns empty array for null input', () => {
    expect(parseUpsetEliminated(null)).toEqual([])
  })

  it('returns empty array for malformed JSON', () => {
    expect(parseUpsetEliminated('garbage')).toEqual([])
  })

  it('returns parsed UUIDs for valid JSON array', () => {
    expect(parseUpsetEliminated(JSON.stringify([SPAIN, BRAZIL]))).toEqual([SPAIN, BRAZIL])
  })
})

describe('validateUpsetOptions', () => {
  const valid: MultiTeamWeightedOptions = {
    maxPicks: 2,
    minPicks: 2,
    choices: CHOICES,
  }

  it('returns the typed options when shape is valid', () => {
    expect(validateUpsetOptions(valid)).toEqual(valid)
  })

  it('returns null when input is not an object', () => {
    expect(validateUpsetOptions('not-an-object')).toBeNull()
    expect(validateUpsetOptions(null)).toBeNull()
  })

  it('returns null when choices array is missing', () => {
    expect(validateUpsetOptions({ maxPicks: 2, minPicks: 2 })).toBeNull()
  })

  it('returns null when a choice has an invalid points value', () => {
    expect(validateUpsetOptions({
      maxPicks: 2,
      minPicks: 2,
      choices: [{ teamId: SPAIN, points: 'a lot' }],
    })).toBeNull()
  })
})

describe('resolveUpsetMaxPoints', () => {
  it('returns the sum of the top maxPicks point values', () => {
    expect(resolveUpsetMaxPoints({ maxPicks: 2, minPicks: 2, choices: CHOICES })).toBe(35)
  })

  it('returns 0 when choices is empty', () => {
    expect(resolveUpsetMaxPoints({ maxPicks: 2, minPicks: 2, choices: [] })).toBe(0)
  })
})

// ─── deriveEliminatedFromBracket ─────────────────────────────────────────────

const teamId = (g: string, n: number): string =>
  `${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}-0000-0000-0000-00000000000${n}`

const SMALL_TEMPLATE: readonly BracketMatch[] = [
  { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: null },
  { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'RU_D1', winnerTo: null },
]

const SMALL_STANDINGS: AllGroupsStandingAnswer = {
  groups: {
    A: [teamId('A', 1), teamId('A', 2), teamId('A', 3), teamId('A', 4)],
    B: [teamId('B', 1), teamId('B', 2), teamId('B', 3), teamId('B', 4)],
    C: [teamId('C', 1), teamId('C', 2), teamId('C', 3), teamId('C', 4)],
    D: [teamId('D', 1), teamId('D', 2), teamId('D', 3), teamId('D', 4)],
  },
  best3rds: [],
}

describe('deriveEliminatedFromBracket', () => {
  it('returns choices that are NOT in the last_32 participant set', () => {
    // last_32 participants for SMALL_STANDINGS: {A1, B2, C1, D2}
    // CHOICES: SPAIN, FRANCE, BRAZIL, CANADA — none in last_32 → all eliminated
    const eliminated = deriveEliminatedFromBracket(
      { maxPicks: 2, minPicks: 2, choices: CHOICES },
      SMALL_TEMPLATE,
      SMALL_STANDINGS,
      null,
    )
    expect(eliminated).toEqual([SPAIN, FRANCE, BRAZIL, CANADA])
  })

  it('excludes teams that ARE in last_32', () => {
    // Override A1 → SPAIN. SPAIN now in last_32 → not eliminated.
    const standings: AllGroupsStandingAnswer = {
      ...SMALL_STANDINGS,
      groups: {
        ...SMALL_STANDINGS.groups,
        A: [SPAIN, teamId('A', 2), teamId('A', 3), teamId('A', 4)],
      },
    }
    const eliminated = deriveEliminatedFromBracket(
      { maxPicks: 2, minPicks: 2, choices: CHOICES },
      SMALL_TEMPLATE,
      standings,
      null,
    )
    expect(eliminated).toEqual([FRANCE, BRAZIL, CANADA])
  })

  it('returns null when group standings are missing', () => {
    expect(deriveEliminatedFromBracket(
      { maxPicks: 2, minPicks: 2, choices: CHOICES },
      SMALL_TEMPLATE,
      null,
      null,
    )).toBeNull()
  })

  it('returns null when template is empty', () => {
    expect(deriveEliminatedFromBracket(
      { maxPicks: 2, minPicks: 2, choices: CHOICES },
      [],
      SMALL_STANDINGS,
      null,
    )).toBeNull()
  })

  it('returns null when any last_32 slot is unresolved (e.g. 3rd_ slot without best3rds)', () => {
    // Template references a 3rd_ slot which requires best3rds to be populated. If standings
    // doesn't have all 8 best3rds, that slot won't resolve → entire derive is rejected.
    const TEMPLATE_WITH_3RD: readonly BracketMatch[] = [
      { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: null },
      { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: '3rd_ABCDF', winnerTo: null },
    ]
    expect(deriveEliminatedFromBracket(
      { maxPicks: 2, minPicks: 2, choices: CHOICES },
      TEMPLATE_WITH_3RD,
      SMALL_STANDINGS, // no best3rds populated
      null,
    )).toBeNull()
  })

  it('combines correctly with scoreUpsetSpecial — picked team eliminated → points awarded', () => {
    const eliminated = deriveEliminatedFromBracket(
      { maxPicks: 2, minPicks: 2, choices: CHOICES },
      SMALL_TEMPLATE,
      SMALL_STANDINGS,
      null,
    )!
    // User picked SPAIN + FRANCE; both are in CHOICES and both ended up eliminated.
    const points = scoreUpsetSpecial([SPAIN, FRANCE], eliminated, CHOICES)
    expect(points).toBe(18 + 17)
  })
})
