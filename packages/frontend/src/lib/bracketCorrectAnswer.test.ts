import { describe, it, expect } from 'vitest'
import {
  buildCorrectAnswer,
  emptyCorrectAnswer,
  parseBracketProgressionCorrectAnswer,
  type AdminCorrectAnswerRound,
} from './bracketCorrectAnswer.js'
import type { BracketProgressionCorrectAnswer } from '../types/index.js'

const teams = (n: number, offset = 0): string[] =>
  Array.from({ length: n }, (_, i) => `team_${i + offset + 1}`)

describe('emptyCorrectAnswer', () => {
  it('returns a blank participants/champion/bronze structure', () => {
    const a = emptyCorrectAnswer()
    expect(a.participants.last_32).toEqual([])
    expect(a.participants.last_16).toEqual([])
    expect(a.participants.qf).toEqual([])
    expect(a.participants.sf).toEqual([])
    expect(a.participants.final).toEqual([])
    expect(a.champion).toBeNull()
    expect(a.bronzeWinner).toBeNull()
  })
})

describe('buildCorrectAnswer — last_32', () => {
  it('accepts exactly 32 teams and stores them as the last_32 participant set', () => {
    const picks = teams(32)
    const next = buildCorrectAnswer('last_32', picks, null)
    expect(next.participants.last_32).toEqual(picks)
    expect(next.participants.last_16).toEqual([])
  })

  it('throws when fewer than 32 teams provided for a non-empty save', () => {
    expect(() => buildCorrectAnswer('last_32', teams(31), null)).toThrow(/last_32.*32/)
  })

  it('allows an empty save (= reset that round)', () => {
    const seeded = buildCorrectAnswer('last_32', teams(32), null)
    const cleared = buildCorrectAnswer('last_32', [], seeded)
    expect(cleared.participants.last_32).toEqual([])
  })

  it('clears all downstream rounds when last_32 changes', () => {
    const base: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: teams(32),
        last_16: teams(16),
        qf: teams(8),
        sf: teams(4),
        final: teams(2),
      },
      champion: 'team_1',
      bronzeWinner: 'team_3',
    }
    const next = buildCorrectAnswer('last_32', teams(32, 100), base)
    expect(next.participants.last_16).toEqual([])
    expect(next.participants.qf).toEqual([])
    expect(next.participants.sf).toEqual([])
    expect(next.participants.final).toEqual([])
    expect(next.champion).toBeNull()
    expect(next.bronzeWinner).toBeNull()
  })
})

describe('buildCorrectAnswer — last_16 / qf / sf / final', () => {
  const base: BracketProgressionCorrectAnswer = {
    participants: {
      last_32: teams(32),
      last_16: [],
      qf: [],
      sf: [],
      final: [],
    },
    champion: null,
    bronzeWinner: null,
  }

  it('last_16 must be a subset of last_32 and exactly 16 teams', () => {
    const ok = teams(16) // subset of teams(32)
    expect(buildCorrectAnswer('last_16', ok, base).participants.last_16).toEqual(ok)
    expect(() => buildCorrectAnswer('last_16', teams(15), base)).toThrow(/last_16.*16/)
    expect(() => buildCorrectAnswer('last_16', ['rogue', ...teams(15)], base)).toThrow(/not in pool/)
  })

  it('qf requires last_16 set and trims sf/final/champion/bronze downstream when changed', () => {
    const seeded: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: teams(32),
        last_16: teams(16),
        qf: teams(8),
        sf: teams(4),
        final: teams(2),
      },
      champion: 'team_1',
      bronzeWinner: 'team_3',
    }
    const next = buildCorrectAnswer('qf', teams(8, 4), seeded) // pick teams 5..12
    expect(next.participants.qf).toEqual(teams(8, 4))
    expect(next.participants.sf).toEqual([])
    expect(next.participants.final).toEqual([])
    expect(next.champion).toBeNull()
    expect(next.bronzeWinner).toBeNull()
    expect(next.participants.last_16).toEqual(teams(16)) // upstream untouched
    expect(next.participants.last_32).toEqual(teams(32)) // upstream untouched
  })

  it('sf must be a subset of qf and exactly 4 teams', () => {
    const seeded = { ...base, participants: { ...base.participants, last_16: teams(16), qf: teams(8) } }
    expect(buildCorrectAnswer('sf', teams(4), seeded).participants.sf).toEqual(teams(4))
    expect(() => buildCorrectAnswer('sf', teams(5), seeded)).toThrow(/sf.*4/)
    expect(() => buildCorrectAnswer('sf', ['team_9', 'team_10', 'team_11', 'team_12'], seeded)).toThrow(/not in pool/)
  })

  it('final must be a subset of sf and exactly 2 teams', () => {
    const seeded: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: teams(32), last_16: teams(16), qf: teams(8), sf: teams(4), final: [],
      },
      champion: null, bronzeWinner: null,
    }
    expect(buildCorrectAnswer('final', teams(2), seeded).participants.final).toEqual(teams(2))
    expect(() => buildCorrectAnswer('final', teams(3), seeded)).toThrow(/final.*2/)
    expect(() => buildCorrectAnswer('final', ['team_5', 'team_6'], seeded)).toThrow(/not in pool/)
  })
})

describe('buildCorrectAnswer — champion', () => {
  const base: BracketProgressionCorrectAnswer = {
    participants: { last_32: teams(32), last_16: teams(16), qf: teams(8), sf: teams(4), final: teams(2) },
    champion: null, bronzeWinner: null,
  }

  it('accepts a single team that is in the final pool', () => {
    expect(buildCorrectAnswer('champion', ['team_1'], base).champion).toBe('team_1')
  })

  it('rejects two teams or a team not in final', () => {
    expect(() => buildCorrectAnswer('champion', ['team_1', 'team_2'], base)).toThrow(/champion.*1/)
    expect(() => buildCorrectAnswer('champion', ['team_5'], base)).toThrow(/not in pool/)
  })

  it('empty save clears the champion', () => {
    const seeded = { ...base, champion: 'team_1' as string | null }
    expect(buildCorrectAnswer('champion', [], seeded).champion).toBeNull()
  })
})

describe('buildCorrectAnswer — bronze', () => {
  const base: BracketProgressionCorrectAnswer = {
    participants: { last_32: teams(32), last_16: teams(16), qf: teams(8), sf: teams(4), final: teams(2) },
    champion: null, bronzeWinner: null,
  }

  it('accepts a single team from sf \\ final (an SF loser)', () => {
    expect(buildCorrectAnswer('bronze', ['team_3'], base).bronzeWinner).toBe('team_3')
  })

  it('rejects a team that is in final (finalists cannot play bronze)', () => {
    expect(() => buildCorrectAnswer('bronze', ['team_1'], base)).toThrow(/not in pool/)
  })

  it('rejects two teams', () => {
    expect(() => buildCorrectAnswer('bronze', ['team_3', 'team_4'], base)).toThrow(/bronze.*1/)
  })

  it('rejects a team not in sf at all', () => {
    expect(() => buildCorrectAnswer('bronze', ['team_10'], base)).toThrow(/not in pool/)
  })

  it('empty save clears bronze', () => {
    const seeded = { ...base, bronzeWinner: 'team_3' as string | null }
    expect(buildCorrectAnswer('bronze', [], seeded).bronzeWinner).toBeNull()
  })
})

describe('buildCorrectAnswer — round names', () => {
  it('rejects unknown round names', () => {
    const fn = (): unknown => buildCorrectAnswer('garbage' as unknown as AdminCorrectAnswerRound, [], null)
    expect(fn).toThrow(/round/)
  })
})

describe('parseBracketProgressionCorrectAnswer', () => {
  it('parses a valid participants payload', () => {
    const json = JSON.stringify({
      participants: { last_32: ['a', 'b'], last_16: ['a'], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: null,
    })
    const parsed = parseBracketProgressionCorrectAnswer(json)
    expect(parsed).not.toBeNull()
    expect(parsed?.participants.last_32).toEqual(['a', 'b'])
  })

  it('returns null on the legacy winners-map shape (callers fall back to empty)', () => {
    expect(parseBracketProgressionCorrectAnswer('{"winners":{"x":"y"}}')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    expect(parseBracketProgressionCorrectAnswer('{nope')).toBeNull()
  })

  it('returns null when participants is missing or not an object', () => {
    expect(parseBracketProgressionCorrectAnswer('{}')).toBeNull()
    expect(parseBracketProgressionCorrectAnswer('{"participants":42}')).toBeNull()
  })

  it('round-trips emptyCorrectAnswer via JSON', () => {
    const a = emptyCorrectAnswer()
    const json = JSON.stringify(a)
    const parsed = parseBracketProgressionCorrectAnswer(json)
    expect(parsed).toEqual(a)
  })
})
