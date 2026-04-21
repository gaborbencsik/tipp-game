import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockValues, mockOnConflictDoNothing, mockSelect, mockFrom, mockWhere, mockOrderBy } = vi.hoisted(() => {
  const mockOnConflictDoNothing = vi.fn()
  const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  const mockOrderBy = vi.fn()
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }))
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockInsert, mockValues, mockOnConflictDoNothing, mockSelect, mockFrom, mockWhere, mockOrderBy }
})

vi.mock('../src/db/client.js', () => ({
  db: { insert: mockInsert, select: mockSelect },
}))

import { isValidEmail, addToWaitlist, getWaitlistEntries } from '../src/services/waitlist.service.js'
import * as schema from '../src/db/schema/index.js'

describe('isValidEmail', () => {
  it('accepts valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(isValidEmail('user@mail.example.co.uk')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects email without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects email without local part', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('rejects email with spaces', () => {
    expect(isValidEmail('us er@example.com')).toBe(false)
  })

  it('rejects email longer than 255 characters', () => {
    const longEmail = 'a'.repeat(250) + '@b.com'
    expect(isValidEmail(longEmail)).toBe(false)
  })

  it('accepts email exactly 255 characters', () => {
    const email = 'a'.repeat(246) + '@b.com.hu'
    expect(email.length).toBe(255)
    expect(isValidEmail(email)).toBe(true)
  })
})

describe('addToWaitlist', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockOnConflictDoNothing.mockResolvedValue(undefined)
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('inserts email with correct table and values', async () => {
    await addToWaitlist('User@Example.COM', 'hero')

    expect(mockInsert).toHaveBeenCalledWith(schema.waitlistEntries)
    expect(mockValues).toHaveBeenCalledWith({
      email: 'user@example.com',
      source: 'hero',
    })
    expect(mockOnConflictDoNothing).toHaveBeenCalled()
  })

  it('trims whitespace from email', async () => {
    await addToWaitlist('  user@example.com  ', 'footer')

    expect(mockValues).toHaveBeenCalledWith({
      email: 'user@example.com',
      source: 'footer',
    })
  })

  it('passes source correctly for footer', async () => {
    await addToWaitlist('test@test.com', 'footer')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'footer' })
    )
  })

  it('uses onConflictDoNothing for duplicate emails', async () => {
    await addToWaitlist('dup@example.com', 'hero')

    expect(mockOnConflictDoNothing).toHaveBeenCalled()
  })
})

describe('getWaitlistEntries', () => {
  const ROW_1 = {
    id: 'uuid-1',
    email: 'alice@example.com',
    source: 'hero' as const,
    createdAt: new Date('2026-04-20T10:00:00Z'),
  }

  const ROW_2 = {
    id: 'uuid-2',
    email: 'bob@example.com',
    source: 'footer' as const,
    createdAt: new Date('2026-04-19T08:00:00Z'),
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  function setupMock(countResult: { count: number }[], entries: typeof ROW_1[]): void {
    let callIndex = 0
    mockSelect.mockImplementation(() => {
      const current = callIndex++
      return {
        from: () => ({
          where: current === 0
            ? () => countResult
            : () => ({ orderBy: () => entries }),
        }),
      }
    })
  }

  it('returns entries sorted by createdAt descending', async () => {
    setupMock([{ count: 2 }], [ROW_1, ROW_2])

    const result = await getWaitlistEntries()

    expect(result.totalCount).toBe(2)
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]).toEqual({
      id: 'uuid-1',
      email: 'alice@example.com',
      source: 'hero',
      createdAt: '2026-04-20T10:00:00.000Z',
    })
    expect(result.entries[1]).toEqual({
      id: 'uuid-2',
      email: 'bob@example.com',
      source: 'footer',
      createdAt: '2026-04-19T08:00:00.000Z',
    })
  })

  it('returns empty entries when no waitlist items', async () => {
    setupMock([{ count: 0 }], [])

    const result = await getWaitlistEntries()

    expect(result.totalCount).toBe(0)
    expect(result.entries).toEqual([])
  })

  it('passes source filter when provided', async () => {
    setupMock([{ count: 1 }], [ROW_1])

    const result = await getWaitlistEntries({ source: 'hero' })

    expect(result.totalCount).toBe(1)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.source).toBe('hero')
  })

  it('passes search filter when provided', async () => {
    setupMock([{ count: 1 }], [ROW_1])

    const result = await getWaitlistEntries({ search: 'alice' })

    expect(result.totalCount).toBe(1)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.email).toBe('alice@example.com')
  })

  it('handles combined source and search filters', async () => {
    setupMock([{ count: 1 }], [ROW_1])

    const result = await getWaitlistEntries({ source: 'hero', search: 'alice' })

    expect(result.totalCount).toBe(1)
    expect(result.entries).toHaveLength(1)
  })

  it('returns totalCount 0 when count query returns empty', async () => {
    setupMock([], [])

    const result = await getWaitlistEntries()

    expect(result.totalCount).toBe(0)
    expect(result.entries).toEqual([])
  })
})
