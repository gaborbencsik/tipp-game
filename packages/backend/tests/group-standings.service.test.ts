import { describe, it, expect } from 'vitest'
import {
  parseAllGroupsStandingAnswer,
  validateAllGroupsStandingOptions,
  validateAllGroupsStandingAnswer,
  computeCompletion,
  type GroupTeamMembership,
} from '../src/services/group-standings.service.js'
import type { AllGroupsStandingOptions } from '../src/types/index.js'

const A1 = 'aaaaaaaa-0000-0000-0000-00000000000a'
const A2 = 'aaaaaaaa-0000-0000-0000-00000000000b'
const A3 = 'aaaaaaaa-0000-0000-0000-00000000000c'
const A4 = 'aaaaaaaa-0000-0000-0000-00000000000d'
const B1 = 'bbbbbbbb-0000-0000-0000-00000000000a'
const B2 = 'bbbbbbbb-0000-0000-0000-00000000000b'
const B3 = 'bbbbbbbb-0000-0000-0000-00000000000c'
const B4 = 'bbbbbbbb-0000-0000-0000-00000000000d'

const options: AllGroupsStandingOptions = {
  groups: ['A', 'B'],
  teamsPerGroup: 4,
  best3rdPicks: 1,
}

const membership: GroupTeamMembership = {
  groups: new Map([
    ['A', new Set([A1, A2, A3, A4])],
    ['B', new Set([B1, B2, B3, B4])],
  ]),
}

describe('parseAllGroupsStandingAnswer', () => {
  it('parses a valid answer JSON', () => {
    const json = JSON.stringify({
      groups: { A: [A1, A2, A3, A4], B: [null, null, null, null] },
      best3rds: [A3],
    })
    const parsed = parseAllGroupsStandingAnswer(json)
    expect(parsed).toEqual({
      groups: { A: [A1, A2, A3, A4], B: [null, null, null, null] },
      best3rds: [A3],
    })
  })

  it('returns null for malformed JSON', () => {
    expect(parseAllGroupsStandingAnswer('not json')).toBeNull()
  })

  it('returns null when groups is missing', () => {
    expect(parseAllGroupsStandingAnswer(JSON.stringify({ best3rds: [] }))).toBeNull()
  })

  it('returns null when group entry has non-string non-null', () => {
    const json = JSON.stringify({ groups: { A: [A1, 42, null, null] }, best3rds: [] })
    expect(parseAllGroupsStandingAnswer(json)).toBeNull()
  })

  it('returns null when best3rds contains non-string', () => {
    const json = JSON.stringify({ groups: {}, best3rds: [A1, 1] })
    expect(parseAllGroupsStandingAnswer(json)).toBeNull()
  })
})

describe('validateAllGroupsStandingOptions', () => {
  it('returns options when shape is valid', () => {
    expect(validateAllGroupsStandingOptions(options)).toEqual(options)
  })

  it('returns null when groups missing', () => {
    expect(validateAllGroupsStandingOptions({ teamsPerGroup: 4, best3rdPicks: 4 })).toBeNull()
  })

  it('returns null when groups is empty', () => {
    expect(validateAllGroupsStandingOptions({ groups: [], teamsPerGroup: 4, best3rdPicks: 4 })).toBeNull()
  })

  it('returns null when teamsPerGroup is not a number', () => {
    expect(validateAllGroupsStandingOptions({ groups: ['A'], teamsPerGroup: '4', best3rdPicks: 1 })).toBeNull()
  })
})

describe('validateAllGroupsStandingAnswer', () => {
  it('accepts a partial answer', () => {
    const result = validateAllGroupsStandingAnswer(
      { groups: { A: [A1, null, null, null] }, best3rds: [] },
      options,
      membership,
    )
    if ('error' in result) throw new Error(result.error)
    expect(result.answer.groups.A).toEqual([A1, null, null, null])
    expect(result.answer.groups.B).toEqual([null, null, null, null])
    expect(result.completion).toEqual({ groupsDone: 0, best3rdsDone: 0, totalDone: 0, totalSteps: 3 })
  })

  it('accepts a full answer with valid best3rd', () => {
    const result = validateAllGroupsStandingAnswer(
      {
        groups: { A: [A1, A2, A3, A4], B: [B1, B2, B3, B4] },
        best3rds: [A3],
      },
      options,
      membership,
    )
    if ('error' in result) throw new Error(result.error)
    expect(result.completion).toEqual({ groupsDone: 2, best3rdsDone: 1, totalDone: 3, totalSteps: 3 })
  })

  it('rejects unknown group code', () => {
    const result = validateAllGroupsStandingAnswer(
      { groups: { Z: [A1, A2, A3, A4] }, best3rds: [] },
      options,
      membership,
    )
    expect(result).toEqual({ error: 'unknown_group:Z' })
  })

  it('rejects team from wrong group', () => {
    const result = validateAllGroupsStandingAnswer(
      { groups: { A: [B1, null, null, null] }, best3rds: [] },
      options,
      membership,
    )
    expect(result).toEqual({ error: `team_not_in_group:A:${B1}` })
  })

  it('rejects duplicate teams within a group', () => {
    const result = validateAllGroupsStandingAnswer(
      { groups: { A: [A1, A1, null, null] }, best3rds: [] },
      options,
      membership,
    )
    expect(result).toEqual({ error: `duplicate_team:A:${A1}` })
  })

  it('rejects wrong-length group array', () => {
    const result = validateAllGroupsStandingAnswer(
      { groups: { A: [A1, A2] }, best3rds: [] },
      options,
      membership,
    )
    expect(result).toEqual({ error: 'wrong_length:A' })
  })

  it('rejects best3rd that is not a 3rd place team', () => {
    const result = validateAllGroupsStandingAnswer(
      {
        groups: { A: [A1, A2, A3, A4], B: [B1, B2, B3, B4] },
        best3rds: [A1],
      },
      options,
      membership,
    )
    expect(result).toEqual({ error: `best3rd_not_third_place:${A1}` })
  })

  it('rejects more than allowed best3rds', () => {
    const result = validateAllGroupsStandingAnswer(
      {
        groups: { A: [A1, A2, A3, A4], B: [B1, B2, B3, B4] },
        best3rds: [A3, B3],
      },
      options,
      membership,
    )
    expect(result).toEqual({ error: 'too_many_best3rds' })
  })

  it('rejects duplicate best3rds', () => {
    const result = validateAllGroupsStandingAnswer(
      {
        groups: { A: [A1, A2, A3, A4], B: [B1, B2, B3, B4] },
        best3rds: [A3, A3],
      },
      { ...options, best3rdPicks: 2 },
      membership,
    )
    expect(result).toEqual({ error: `duplicate_best3rd:${A3}` })
  })
})

describe('computeCompletion', () => {
  it('counts only fully filled groups', () => {
    const completion = computeCompletion(
      { A: [A1, A2, A3, A4], B: [B1, null, null, null] },
      [A3],
      options,
    )
    expect(completion).toEqual({ groupsDone: 1, best3rdsDone: 1, totalDone: 2, totalSteps: 3 })
  })
})
