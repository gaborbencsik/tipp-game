import { describe, it, expect } from 'vitest'
import {
  scoreUpsetSpecial,
  parseUpsetPicks,
  parseUpsetEliminated,
  validateUpsetOptions,
  resolveUpsetMaxPoints,
} from '../src/services/upset-special.service.js'
import type { MultiTeamWeightedOptions } from '../src/types/index.js'

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
