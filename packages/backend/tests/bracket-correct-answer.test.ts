import { describe, it, expect } from 'vitest'
import {
  validateBracketProgressionCorrectAnswer,
  parseBracketProgressionCorrectAnswer,
  isBracketProgressionCorrectAnswer,
} from '../src/services/bracket-correct-answer.js'
import type { BracketProgressionCorrectAnswer } from '../src/types/index.js'

// Build 32 sequential UUID-shaped ids — content irrelevant for set membership tests.
const ids = (n: number): readonly string[] =>
  Array.from({ length: n }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`)

const ALL32 = ids(32)
const first16 = ALL32.slice(0, 16)
const first8 = first16.slice(0, 8)
const first4 = first8.slice(0, 4)
const first2 = first4.slice(0, 2)

const VALID: BracketProgressionCorrectAnswer = {
  participants: {
    last_32: ALL32,
    last_16: first16,
    qf: first8,
    sf: first4,
    final: first2,
  },
  champion: first2[0],
  bronzeWinner: first4[2], // sf \ final
}

describe('validateBracketProgressionCorrectAnswer', () => {
  it('accepts a fully valid correct answer', () => {
    const result = validateBracketProgressionCorrectAnswer(VALID)
    expect(result.ok).toBe(true)
  })

  it('accepts null bronzeWinner (bronze optional)', () => {
    const result = validateBracketProgressionCorrectAnswer({ ...VALID, bronzeWinner: null })
    expect(result.ok).toBe(true)
  })

  it('accepts null champion (final stage not yet decided)', () => {
    const result = validateBracketProgressionCorrectAnswer({ ...VALID, champion: null })
    expect(result.ok).toBe(true)
  })

  it('rejects last_32 with wrong size', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, last_32: ALL32.slice(0, 30) },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_round_size_mismatch:last_32')
  })

  it('rejects last_16 with wrong size', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, last_16: first16.slice(0, 15) },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_round_size_mismatch:last_16')
  })

  it('rejects qf with wrong size', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, qf: first8.slice(0, 7) },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_round_size_mismatch:qf')
  })

  it('rejects sf with wrong size', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, sf: first4.slice(0, 3) },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_round_size_mismatch:sf')
  })

  it('rejects final with wrong size', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, final: [first2[0]] },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_round_size_mismatch:final')
  })

  it('rejects last_16 not subset of last_32', () => {
    const last16BadSubset = [...first16.slice(0, 15), 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, last_16: last16BadSubset },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_subset_violation:last_16')
  })

  it('rejects qf not subset of last_16', () => {
    const qfBad = [...first8.slice(0, 7), ALL32[20]] // ∈ last_32 but ∉ last_16
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, qf: qfBad },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_subset_violation:qf')
  })

  it('rejects sf not subset of qf', () => {
    const sfBad = [...first4.slice(0, 3), first8[5]] // ∈ qf but actually... let me make it ∉ qf
    const sfBadReal = [...first4.slice(0, 3), first16[10]] // ∈ last_16 but ∉ qf
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, sf: sfBadReal },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_subset_violation:sf')
    // sfBad isn't used elsewhere; keep the reference to silence unused warnings.
    expect(sfBad).toBeDefined()
  })

  it('rejects final not subset of sf', () => {
    const finalBad = [first4[0], first8[5]] // 2nd team ∈ qf but ∉ sf
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, final: finalBad },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_subset_violation:final')
  })

  it('rejects duplicate teams within a round', () => {
    const dupLast16 = [first16[0], ...first16.slice(0, 15)]
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      participants: { ...VALID.participants, last_16: dupLast16 },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_duplicate_team:last_16')
  })

  it('rejects champion not in final', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      champion: first4[3], // ∈ sf, ∉ final
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_champion_not_in_final')
  })

  it('rejects bronzeWinner inside final', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      bronzeWinner: first2[1], // ∈ final → invalid for bronze
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_bronze_invalid')
  })

  it('rejects bronzeWinner not in sf', () => {
    const result = validateBracketProgressionCorrectAnswer({
      ...VALID,
      bronzeWinner: ALL32[31], // ∈ last_32 but ∉ sf
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('bracket_bronze_invalid')
  })
})

describe('isBracketProgressionCorrectAnswer', () => {
  it('returns true on the new participants shape', () => {
    expect(isBracketProgressionCorrectAnswer(VALID)).toBe(true)
  })

  it('returns false on legacy winners-map shape', () => {
    expect(isBracketProgressionCorrectAnswer({ winners: {} })).toBe(false)
  })

  it('returns false on null / non-object', () => {
    expect(isBracketProgressionCorrectAnswer(null)).toBe(false)
    expect(isBracketProgressionCorrectAnswer('foo')).toBe(false)
  })
})

describe('parseBracketProgressionCorrectAnswer', () => {
  it('parses a stringified new-shape JSON', () => {
    const parsed = parseBracketProgressionCorrectAnswer(JSON.stringify(VALID))
    expect(parsed).not.toBeNull()
    expect(parsed?.participants.last_32.length).toBe(32)
    expect(parsed?.champion).toBe(first2[0])
  })

  it('returns null on legacy winners-map JSON', () => {
    expect(parseBracketProgressionCorrectAnswer('{"winners":{}}')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    expect(parseBracketProgressionCorrectAnswer('{not-json')).toBeNull()
  })

  it('returns null when participants object is incomplete', () => {
    expect(parseBracketProgressionCorrectAnswer(JSON.stringify({
      participants: { last_32: ALL32 },
      champion: null,
      bronzeWinner: null,
    }))).toBeNull()
  })
})
