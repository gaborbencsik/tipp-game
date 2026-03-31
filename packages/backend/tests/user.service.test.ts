import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthenticatedUser, DbUser } from '../src/types/index.js'

const {
  mockInsert, mockValues, mockOnConflictDoUpdate, mockReturning,
  mockUpdate, mockSet, mockWhere, mockUpdateReturning,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn()
  const mockWhere = vi.fn(() => ({ returning: mockUpdateReturning }))
  const mockSet = vi.fn(() => ({ where: mockWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockSet }))

  const mockReturning = vi.fn()
  const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }))
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))

  return { mockInsert, mockValues, mockOnConflictDoUpdate, mockReturning, mockUpdate, mockSet, mockWhere, mockUpdateReturning }
})

vi.mock('../src/db/client.js', () => ({
  db: { insert: mockInsert, update: mockUpdate },
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

    mockUpdateReturning.mockResolvedValue([RETURNED_ROW])
    mockWhere.mockReturnValue({ returning: mockUpdateReturning })
    mockSet.mockReturnValue({ where: mockWhere })
    mockUpdate.mockReturnValue({ set: mockSet })
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

  it('email conflict (23505) → falls back to UPDATE by email and returns DbUser', async () => {
    const pgError = Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), { code: '23505' })
    mockReturning.mockRejectedValue(pgError)

    const updatedRow: DbUser = { ...RETURNED_ROW, supabaseId: 'supabase-uuid-abc' }
    mockUpdateReturning.mockResolvedValue([updatedRow])

    const result = await upsertUser(BASE_USER)

    expect(mockUpdate).toHaveBeenCalledWith(schema.users)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        supabaseId: 'supabase-uuid-abc',
        displayName: 'John Doe',
      })
    )
    expect(result).toEqual(updatedRow)
  })

  it('email conflict via Drizzle wrapper (cause.code 23505) → falls back to UPDATE by email', async () => {
    const pgCause = Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), { code: '23505' })
    const drizzleWrapper = Object.assign(new Error('Failed query: insert into "users"...'), { cause: pgCause })
    mockReturning.mockRejectedValue(drizzleWrapper)

    const updatedRow: DbUser = { ...RETURNED_ROW, supabaseId: 'supabase-uuid-abc' }
    mockUpdateReturning.mockResolvedValue([updatedRow])

    const result = await upsertUser(BASE_USER)

    expect(mockUpdate).toHaveBeenCalledWith(schema.users)
    expect(result).toEqual(updatedRow)
  })

  it('non-23505 DB error → rethrows the error', async () => {
    const dbError = Object.assign(new Error('connection refused'), { code: '08006' })
    mockReturning.mockRejectedValue(dbError)

    await expect(upsertUser(BASE_USER)).rejects.toThrow('connection refused')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
