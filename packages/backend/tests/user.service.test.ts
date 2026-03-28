import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthenticatedUser, DbUser } from '../src/types/index.js'

const { mockInsert, mockValues, mockOnConflictDoUpdate, mockReturning } = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }))
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  return { mockInsert, mockValues, mockOnConflictDoUpdate, mockReturning }
})

vi.mock('../src/db/client.js', () => ({
  db: { insert: mockInsert },
}))

import { upsertUser } from '../src/services/user.service.js'
import * as schema from '../src/db/schema/index.js'

const BASE_USER: AuthenticatedUser = {
  supabaseId: 'supabase-uuid-abc',
  email: 'user@example.com',
  displayName: 'John Doe',
  avatarUrl: 'https://avatar.example.com/john.png',
}

const RETURNED_ROW: DbUser = {
  id: 'db-uuid-123',
  supabaseId: 'supabase-uuid-abc',
  email: 'user@example.com',
  displayName: 'John Doe',
  avatarUrl: 'https://avatar.example.com/john.png',
  role: 'user',
}

describe('upsertUser', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockReturning.mockResolvedValue([RETURNED_ROW])
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning })
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('new user → inserts and returns DbUser', async () => {
    const result = await upsertUser(BASE_USER)
    expect(mockInsert).toHaveBeenCalledWith(schema.users)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseId: 'supabase-uuid-abc',
        email: 'user@example.com',
        displayName: 'John Doe',
        avatarUrl: 'https://avatar.example.com/john.png',
      })
    )
    expect(result).toEqual(RETURNED_ROW)
  })

  it('existing user → calls onConflictDoUpdate with correct target and set', async () => {
    await upsertUser(BASE_USER)
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: schema.users.supabaseId,
        set: expect.objectContaining({
          displayName: 'John Doe',
          avatarUrl: 'https://avatar.example.com/john.png',
        }),
      })
    )
  })

  it('user with email-prefix displayName → persists as-is', async () => {
    const userEmailOnly: AuthenticatedUser = {
      supabaseId: 'supabase-uuid-xyz',
      email: 'noname@example.com',
      displayName: 'noname',
      avatarUrl: null,
    }
    const returnedRow: DbUser = { ...RETURNED_ROW, displayName: 'noname', avatarUrl: null }
    mockReturning.mockResolvedValue([returnedRow])

    await upsertUser(userEmailOnly)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'noname' })
    )
  })
})
