import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsert, mockValues, mockOnConflictDoNothing } = vi.hoisted(() => {
  const mockOnConflictDoNothing = vi.fn()
  const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  return { mockInsert, mockValues, mockOnConflictDoNothing }
})

vi.mock('../src/db/client.js', () => ({
  db: { insert: mockInsert },
}))

import { isValidEmail, addToWaitlist } from '../src/services/waitlist.service.js'
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
