import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdminUser } from '../src/types/index.js'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const {
  mockSelect,
  mockFrom,
  mockSelectWhere,
  mockOrderBy,
  mockUpdate,
  mockSet,
  mockUpdateWhere,
  mockInsert,
  mockValues,
  mockReturning,
  mockLimit,
} = vi.hoisted(() => {
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockReturning = vi.fn().mockResolvedValue([])
  const mockValues = vi.fn().mockResolvedValue(undefined)
  const mockSelectWhere = vi.fn()
  const mockUpdateWhere = vi.fn()
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  const mockSet = vi.fn()
  const mockUpdate = vi.fn()
  const mockInsert = vi.fn()

  return {
    mockSelect,
    mockFrom,
    mockSelectWhere,
    mockUpdateWhere,
    mockOrderBy,
    mockUpdate,
    mockSet,
    mockInsert,
    mockValues,
    mockReturning,
    mockLimit,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}))

import {
  getUsers,
  updateUserRole,
  banUser,
} from '../src/services/admin-users.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')

const USER_ROW = {
  id: 'user-uuid-1',
  supabaseId: 'sb-uuid-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  avatarUrl: null,
  role: 'user' as const,
  bannedAt: null,
  banReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
}

const USER_API: AdminUser = {
  id: 'user-uuid-1',
  email: 'alice@example.com',
  displayName: 'Alice',
  role: 'user',
  bannedAt: null,
  createdAt: NOW.toISOString(),
}

const ACTOR_ID = 'actor-uuid-99'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupSelectChain(rows: unknown[]) {
  mockOrderBy.mockResolvedValue(rows)
  mockLimit.mockResolvedValue(rows)
  mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockSelectWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateChain(rows: unknown[]) {
  mockReturning.mockResolvedValue(rows)
  mockUpdateWhere.mockReturnValue({ returning: mockReturning })
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

function setupInsertChain() {
  mockValues.mockResolvedValue(undefined)
  mockInsert.mockReturnValue({ values: mockValues })
}

// ─── getUsers ─────────────────────────────────────────────────────────────────

describe('getUsers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupSelectChain([])
  })

  it('empty DB → returns []', async () => {
    mockOrderBy.mockResolvedValue([])
    const result = await getUsers()
    expect(result).toEqual([])
  })

  it('rows present → returns AdminUser array', async () => {
    const row2 = { ...USER_ROW, id: 'user-uuid-2', email: 'bob@example.com', displayName: 'Bob' }
    mockOrderBy.mockResolvedValue([USER_ROW, row2])
    const result = await getUsers()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(USER_API)
    expect(result[1]).toMatchObject({ id: 'user-uuid-2', email: 'bob@example.com' })
  })

  it('banned user → bannedAt is ISO string', async () => {
    const bannedRow = { ...USER_ROW, bannedAt: NOW }
    mockOrderBy.mockResolvedValue([bannedRow])
    const result = await getUsers()
    expect(result[0]?.bannedAt).toBe(NOW.toISOString())
  })
})

// ─── updateUserRole ───────────────────────────────────────────────────────────

describe('updateUserRole', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('actorId === userId → AppError 403', async () => {
    await expect(updateUserRole('user-uuid-1', 'admin', 'user-uuid-1')).rejects.toMatchObject({
      status: 403,
      message: 'Cannot change your own role',
    })
  })

  it('non-existing user → AppError 404', async () => {
    setupSelectChain([])
    await expect(updateUserRole('nonexistent', 'admin', ACTOR_ID)).rejects.toMatchObject({
      status: 404,
      message: 'User not found',
    })
  })

  it('valid call → returns updated AdminUser', async () => {
    const updatedRow = { ...USER_ROW, role: 'admin' as const }
    setupSelectChain([USER_ROW])
    setupUpdateChain([updatedRow])
    setupInsertChain()

    const result = await updateUserRole('user-uuid-1', 'admin', ACTOR_ID)
    expect(result.role).toBe('admin')
  })

  it('valid call → audit_logs INSERT called with role_change', async () => {
    const updatedRow = { ...USER_ROW, role: 'admin' as const }
    setupSelectChain([USER_ROW])
    setupUpdateChain([updatedRow])
    setupInsertChain()

    await updateUserRole('user-uuid-1', 'admin', ACTOR_ID)
    expect(mockInsert).toHaveBeenCalledOnce()
    const insertArg = mockValues.mock.calls[0]?.[0] as { action: string }
    expect(insertArg.action).toBe('role_change')
  })
})

// ─── banUser ──────────────────────────────────────────────────────────────────

describe('banUser', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('actorId === userId → AppError 403', async () => {
    await expect(banUser('user-uuid-1', true, 'user-uuid-1')).rejects.toMatchObject({
      status: 403,
      message: 'Cannot ban yourself',
    })
  })

  it('non-existing user → AppError 404', async () => {
    setupSelectChain([])
    await expect(banUser('nonexistent', true, ACTOR_ID)).rejects.toMatchObject({
      status: 404,
      message: 'User not found',
    })
  })

  it('ban=true → bannedAt is set', async () => {
    const bannedRow = { ...USER_ROW, bannedAt: NOW }
    setupSelectChain([USER_ROW])
    setupUpdateChain([bannedRow])
    setupInsertChain()

    const result = await banUser('user-uuid-1', true, ACTOR_ID)
    expect(result.bannedAt).toBe(NOW.toISOString())
  })

  it('ban=false → bannedAt is null', async () => {
    const unbannedRow = { ...USER_ROW, bannedAt: null }
    setupSelectChain([{ ...USER_ROW, bannedAt: NOW }])
    setupUpdateChain([unbannedRow])
    setupInsertChain()

    const result = await banUser('user-uuid-1', false, ACTOR_ID)
    expect(result.bannedAt).toBeNull()
  })

  it('valid ban → audit_logs INSERT called with ban action', async () => {
    const bannedRow = { ...USER_ROW, bannedAt: NOW }
    setupSelectChain([USER_ROW])
    setupUpdateChain([bannedRow])
    setupInsertChain()

    await banUser('user-uuid-1', true, ACTOR_ID)
    expect(mockInsert).toHaveBeenCalledOnce()
    const insertArg = mockValues.mock.calls[0]?.[0] as { action: string }
    expect(insertArg.action).toBe('ban')
  })
})
