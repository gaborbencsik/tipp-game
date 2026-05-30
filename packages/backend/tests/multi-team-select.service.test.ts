import { describe, it, expect } from 'vitest'
import {
  parseMultiTeamSelectPicks,
  validateMultiTeamSelectOptions,
} from '../src/services/multi-team-select.service.js'

const T1 = '11111111-2222-3333-4444-aaaaaaaaaaa1'
const T2 = '11111111-2222-3333-4444-aaaaaaaaaaa2'
const T3 = '11111111-2222-3333-4444-aaaaaaaaaaa3'

describe('parseMultiTeamSelectPicks', () => {
  it('parses a valid JSON array of UUIDs', () => {
    expect(parseMultiTeamSelectPicks(JSON.stringify([T1, T2]))).toEqual([T1, T2])
  })

  it('returns null for malformed JSON', () => {
    expect(parseMultiTeamSelectPicks('not json')).toBeNull()
  })

  it('returns null for non-array JSON', () => {
    expect(parseMultiTeamSelectPicks('{"a":1}')).toBeNull()
  })

  it('returns null when array contains non-string entries', () => {
    expect(parseMultiTeamSelectPicks(JSON.stringify([T1, 42]))).toBeNull()
  })

  it('parses an empty array', () => {
    expect(parseMultiTeamSelectPicks('[]')).toEqual([])
  })
})

describe('validateMultiTeamSelectOptions', () => {
  const valid = {
    maxPicks: 16,
    minPicks: 16,
    teamIds: [T1, T2, T3],
  }

  it('returns the typed options when shape is valid', () => {
    expect(validateMultiTeamSelectOptions(valid)).toEqual(valid)
  })

  it('returns null when input is not an object', () => {
    expect(validateMultiTeamSelectOptions('not-an-object')).toBeNull()
    expect(validateMultiTeamSelectOptions(null)).toBeNull()
  })

  it('returns null when teamIds array is missing', () => {
    expect(validateMultiTeamSelectOptions({ maxPicks: 16, minPicks: 16 })).toBeNull()
  })

  it('returns null when teamIds contains non-string entries', () => {
    expect(validateMultiTeamSelectOptions({
      maxPicks: 16,
      minPicks: 16,
      teamIds: [T1, 42],
    })).toBeNull()
  })

  it('returns null when maxPicks is not a number', () => {
    expect(validateMultiTeamSelectOptions({
      maxPicks: '16',
      minPicks: 16,
      teamIds: [T1],
    })).toBeNull()
  })
})
