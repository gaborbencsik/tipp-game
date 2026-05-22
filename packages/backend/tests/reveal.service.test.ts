import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockInsert, mockSelect } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { insert: mockInsert, select: mockSelect },
}))

import {
  revealInsight,
  isMatchRevealed,
  MatchNotFoundError,
} from '../src/services/insights/reveal.service.js'

describe('revealInsight', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockSelect.mockReset()
  })

  it('inserts a reveal row idempotently and returns { revealed: true }', async () => {
    mockSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'm1' }]) }) }),
    })
    mockInsert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }),
      }),
    })
    const result = await revealInsight('user-1', 'm1')
    expect(result).toEqual({ revealed: true })
    expect(mockInsert).toHaveBeenCalled()
  })

  it('returns { revealed: true } even when row already exists (no error)', async () => {
    mockSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'm1' }]) }) }),
    })
    mockInsert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }),
      }),
    })
    const result = await revealInsight('user-1', 'm1')
    expect(result).toEqual({ revealed: true })
  })

  it('throws MatchNotFoundError when matchId does not exist', async () => {
    mockSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    })
    await expect(revealInsight('user-1', 'unknown')).rejects.toThrow(MatchNotFoundError)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('isMatchRevealed', () => {
  beforeEach(() => {
    mockSelect.mockReset()
  })

  it('returns true when a row exists for (userId, matchId)', async () => {
    mockSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'r1' }]) }) }),
    })
    expect(await isMatchRevealed('user-1', 'm1')).toBe(true)
  })

  it('returns false when no row exists', async () => {
    mockSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    })
    expect(await isMatchRevealed('user-1', 'm1')).toBe(false)
  })
})
