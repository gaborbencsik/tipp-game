import { describe, it, expect } from 'vitest'
import { buildCorrectAnswer, emptyCorrectAnswer } from './bracketCorrectAnswer.js'
import type { BracketProgressionCorrectAnswer } from '../types/index.js'

const id = (n: number): string => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const range = (start: number, end: number): readonly string[] =>
  Array.from({ length: end - start }, (_, i) => id(start + i))

const ALL32 = range(0, 32)
const FIRST16 = range(0, 16)
const FIRST8 = range(0, 8)
const FIRST4 = range(0, 4)
const FIRST2 = range(0, 2)

describe('emptyCorrectAnswer', () => {
  it('returns an empty participants object with nulls for champion/bronzeWinner', () => {
    expect(emptyCorrectAnswer()).toEqual({
      participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: null,
    })
  })
})

describe('buildCorrectAnswer — participants rounds', () => {
  it('updates only the given round and preserves the rest', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: [], qf: [], sf: [], final: [] },
      champion: null,
      bronzeWinner: null,
    }
    const next = buildCorrectAnswer('last_16', FIRST16, prev)
    expect(next.participants.last_32).toEqual(ALL32)
    expect(next.participants.last_16).toEqual(FIRST16)
    expect(next.champion).toBeNull()
  })

  it('seeds last_32 from null (no prev)', () => {
    const next = buildCorrectAnswer('last_32', ALL32, null)
    expect(next.participants.last_32).toEqual(ALL32)
    expect(next.participants.last_16).toEqual([])
  })

  it('clears downstream rounds when an upstream selection changes', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: FIRST8, sf: FIRST4, final: FIRST2 },
      champion: id(0),
      bronzeWinner: id(2),
    }
    const replacement = [...range(8, 24)] // 16 brand-new teams disjoint from prior selections
    const next = buildCorrectAnswer('last_16', replacement, prev)
    expect(next.participants.last_16).toEqual(replacement)
    // qf had teams ∉ new last_16, so it must reset
    expect(next.participants.qf).toEqual([])
    expect(next.participants.sf).toEqual([])
    expect(next.participants.final).toEqual([])
    expect(next.champion).toBeNull()
    expect(next.bronzeWinner).toBeNull()
  })

  it('keeps downstream rounds when they remain valid subsets', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: FIRST8, sf: FIRST4, final: FIRST2 },
      champion: id(0),
      bronzeWinner: id(2),
    }
    // Change last_32 entirely, but keep all of FIRST16 ⊂ last_32 still: include FIRST16 + 16 new.
    const newLast32 = [...FIRST16, ...range(40, 56)]
    const next = buildCorrectAnswer('last_32', newLast32, prev)
    expect(next.participants.last_16).toEqual(FIRST16)
    expect(next.participants.qf).toEqual(FIRST8)
    expect(next.participants.sf).toEqual(FIRST4)
    expect(next.participants.final).toEqual(FIRST2)
    expect(next.champion).toBe(id(0))
    expect(next.bronzeWinner).toBe(id(2))
  })
})

describe('buildCorrectAnswer — champion', () => {
  it('sets champion when target final exists', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: FIRST8, sf: FIRST4, final: FIRST2 },
      champion: null,
      bronzeWinner: null,
    }
    const next = buildCorrectAnswer('champion', [id(1)], prev)
    expect(next.champion).toBe(id(1))
    expect(next.participants.final).toEqual(FIRST2)
  })

  it('clears champion when empty selection is passed', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: FIRST8, sf: FIRST4, final: FIRST2 },
      champion: id(0),
      bronzeWinner: null,
    }
    const next = buildCorrectAnswer('champion', [], prev)
    expect(next.champion).toBeNull()
  })
})

describe('buildCorrectAnswer — bronzeWinner', () => {
  it('sets bronzeWinner from the sf-minus-final pool', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: FIRST8, sf: FIRST4, final: FIRST2 },
      champion: id(0),
      bronzeWinner: null,
    }
    const next = buildCorrectAnswer('bronze', [id(2)], prev)
    expect(next.bronzeWinner).toBe(id(2))
  })

  it('clears bronzeWinner when empty selection is passed', () => {
    const prev: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: FIRST8, sf: FIRST4, final: FIRST2 },
      champion: id(0),
      bronzeWinner: id(3),
    }
    const next = buildCorrectAnswer('bronze', [], prev)
    expect(next.bronzeWinner).toBeNull()
  })
})
