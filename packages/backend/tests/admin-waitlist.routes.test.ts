import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetWaitlistEntries, mockDeleteWaitlistEntry, mockAddWaitlistEntry, mockIsValidEmail, mockAuthMiddleware, mockAdminMiddleware } = vi.hoisted(() => ({
  mockGetWaitlistEntries: vi.fn(),
  mockDeleteWaitlistEntry: vi.fn(),
  mockAddWaitlistEntry: vi.fn(),
  mockIsValidEmail: vi.fn(),
  mockAuthMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
  mockAdminMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('../src/services/waitlist.service.js', () => ({
  getWaitlistEntries: mockGetWaitlistEntries,
  deleteWaitlistEntry: mockDeleteWaitlistEntry,
  addWaitlistEntry: mockAddWaitlistEntry,
  isValidEmail: mockIsValidEmail,
}))

vi.mock('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: mockAuthMiddleware,
}))

vi.mock('../src/middleware/admin.middleware.js', () => ({
  adminMiddleware: mockAdminMiddleware,
}))

// Mock remaining service imports to avoid DB connections
vi.mock('../src/services/teams.service.js', () => ({
  getTeams: vi.fn(), getTeamById: vi.fn(), createTeam: vi.fn(), updateTeam: vi.fn(), deleteTeam: vi.fn(),
}))
vi.mock('../src/services/matches.service.js', () => ({
  createMatch: vi.fn(), updateMatch: vi.fn(), deleteMatch: vi.fn(), setResult: vi.fn(),
}))
vi.mock('../src/services/admin-users.service.js', () => ({
  getUsers: vi.fn(), updateUserRole: vi.fn(), banUser: vi.fn(),
}))
vi.mock('../src/services/user.service.js', () => ({
  upsertUser: vi.fn(),
}))
vi.mock('../src/services/scoring-config.service.js', () => ({
  getGlobalConfig: vi.fn(), updateGlobalConfig: vi.fn(),
}))

import { adminRouter } from '../src/routes/admin.routes.js'

function getHandler(path: string, method: string): { stack: Array<(ctx: never, next: () => Promise<void>) => Promise<void>> } {
  const matched = adminRouter.match(path, method)
  const layers = matched.pathAndMethod
  return layers[layers.length - 1]
}

describe('GET /api/admin/waitlist', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuthMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockAdminMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
  })

  it('returns waitlist entries with totalCount', async () => {
    const mockResult = {
      totalCount: 2,
      entries: [
        { id: 'uuid-1', email: 'a@test.com', source: 'hero', createdAt: '2026-04-20T10:00:00.000Z' },
        { id: 'uuid-2', email: 'b@test.com', source: 'footer', createdAt: '2026-04-19T08:00:00.000Z' },
      ],
    }
    mockGetWaitlistEntries.mockResolvedValue(mockResult)

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: {},
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.body).toEqual(mockResult)
    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({})
  })

  it('passes source filter from query', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { source: 'hero' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({ source: 'hero' })
  })

  it('passes footer source filter from query', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { source: 'footer' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({ source: 'footer' })
  })

  it('ignores invalid source values', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { source: 'invalid' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({})
  })

  it('passes search filter from query', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { search: 'alice' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({ search: 'alice' })
  })

  it('passes both source and search filters', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { source: 'hero', search: 'test' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({ source: 'hero', search: 'test' })
  })

  it('trims search whitespace', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { search: '  alice  ' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({ search: 'alice' })
  })

  it('ignores empty search string', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { search: '   ' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({})
  })

  it('passes admin source filter from query', async () => {
    mockGetWaitlistEntries.mockResolvedValue({ totalCount: 0, entries: [] })

    const handler = getHandler('/api/admin/waitlist', 'GET')
    const ctx: Record<string, unknown> = {
      query: { source: 'admin' },
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(mockGetWaitlistEntries).toHaveBeenCalledWith({ source: 'admin' })
  })
})

describe('DELETE /api/admin/waitlist/:id', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuthMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockAdminMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
  })

  it('returns 204 on successful delete', async () => {
    mockDeleteWaitlistEntry.mockResolvedValue(undefined)

    const handler = getHandler('/api/admin/waitlist/uuid-1', 'DELETE')
    const ctx: Record<string, unknown> = {
      params: { id: 'uuid-1' },
      status: 200,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(204)
    expect(mockDeleteWaitlistEntry).toHaveBeenCalledWith('uuid-1')
  })

  it('throws 404 when entry not found', async () => {
    const error = new Error('Waitlist entry not found') as Error & { status: number }
    error.status = 404
    mockDeleteWaitlistEntry.mockRejectedValue(error)

    const handler = getHandler('/api/admin/waitlist/nonexistent', 'DELETE')
    const ctx: Record<string, unknown> = {
      params: { id: 'nonexistent' },
      status: 200,
    }

    await expect(
      handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    ).rejects.toThrow('Waitlist entry not found')
  })
})

describe('POST /api/admin/waitlist', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuthMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockAdminMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockIsValidEmail.mockReturnValue(true)
  })

  it('returns 201 with the created entry', async () => {
    const newEntry = {
      id: 'uuid-new',
      email: 'new@example.com',
      source: 'admin',
      createdAt: '2026-04-21T12:00:00.000Z',
    }
    mockAddWaitlistEntry.mockResolvedValue(newEntry)

    const handler = getHandler('/api/admin/waitlist', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { email: 'new@example.com' } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(201)
    expect(ctx.body).toEqual(newEntry)
    expect(mockAddWaitlistEntry).toHaveBeenCalledWith('new@example.com', 'admin')
  })

  it('uses provided source instead of default', async () => {
    const newEntry = {
      id: 'uuid-new',
      email: 'new@example.com',
      source: 'hero',
      createdAt: '2026-04-21T12:00:00.000Z',
    }
    mockAddWaitlistEntry.mockResolvedValue(newEntry)

    const handler = getHandler('/api/admin/waitlist', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { email: 'new@example.com', source: 'hero' } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(201)
    expect(mockAddWaitlistEntry).toHaveBeenCalledWith('new@example.com', 'hero')
  })

  it('returns 400 on invalid email', async () => {
    mockIsValidEmail.mockReturnValue(false)

    const handler = getHandler('/api/admin/waitlist', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { email: 'not-an-email' } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({ error: 'Invalid email' })
    expect(mockAddWaitlistEntry).not.toHaveBeenCalled()
  })

  it('returns 400 on missing email', async () => {
    mockIsValidEmail.mockReturnValue(false)

    const handler = getHandler('/api/admin/waitlist', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: {} },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({ error: 'Invalid email' })
  })

  it('returns 400 on invalid source', async () => {
    const handler = getHandler('/api/admin/waitlist', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { email: 'test@example.com', source: 'invalid' } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({ error: 'Invalid source' })
  })

  it('throws 409 on duplicate email', async () => {
    const error = new Error('Email already on waitlist') as Error & { status: number }
    error.status = 409
    mockAddWaitlistEntry.mockRejectedValue(error)

    const handler = getHandler('/api/admin/waitlist', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { email: 'dup@example.com' } },
      status: 200,
      body: undefined,
    }

    await expect(
      handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    ).rejects.toThrow('Email already on waitlist')
  })
})
