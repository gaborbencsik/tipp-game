import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockBroadcast, mockGetTargets, mockUpsertUser,
  mockAuthMiddleware, mockAdminMiddleware,
} = vi.hoisted(() => ({
  mockBroadcast: vi.fn(),
  mockGetTargets: vi.fn(),
  mockUpsertUser: vi.fn(),
  mockAuthMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
  mockAdminMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('../src/services/admin-push.service.js', () => ({
  broadcastToAllUsers: mockBroadcast,
  getBroadcastTargetCount: mockGetTargets,
}))

vi.mock('../src/middleware/auth.middleware.js', () => ({ authMiddleware: mockAuthMiddleware }))
vi.mock('../src/middleware/admin.middleware.js', () => ({ adminMiddleware: mockAdminMiddleware }))

vi.mock('../src/services/user.service.js', () => ({ upsertUser: mockUpsertUser }))

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

import { adminRouter } from '../src/routes/admin.routes.js'

function getHandler(path: string, method: string): { stack: Array<(ctx: never, next: () => Promise<void>) => Promise<void>> } {
  const matched = adminRouter.match(path, method)
  const layers = matched.pathAndMethod
  return layers[layers.length - 1]
}

describe('GET /api/admin/push/targets', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuthMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockAdminMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
  })

  it('returns the broadcast target count', async () => {
    mockGetTargets.mockResolvedValue(42)
    const handler = getHandler('/api/admin/push/targets', 'GET')
    const ctx: Record<string, unknown> = {}
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(ctx.body).toEqual({ count: 42 })
  })
})

describe('POST /api/admin/push/send', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuthMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockAdminMiddleware.mockImplementation(async (_ctx: unknown, next: () => Promise<void>) => next())
    mockUpsertUser.mockResolvedValue({ id: 'admin-1' })
  })

  it('400 when title is missing', async () => {
    const handler = getHandler('/api/admin/push/send', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { body: 'hello' } },
      state: { user: {} },
    }
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(ctx.status).toBe(400)
    expect(mockBroadcast).not.toHaveBeenCalled()
  })

  it('400 when body is missing', async () => {
    const handler = getHandler('/api/admin/push/send', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { title: 'hi' } },
      state: { user: {} },
    }
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(ctx.status).toBe(400)
    expect(mockBroadcast).not.toHaveBeenCalled()
  })

  it('400 when title exceeds 100 chars', async () => {
    const handler = getHandler('/api/admin/push/send', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { title: 'A'.repeat(101), body: 'B' } },
      state: { user: {} },
    }
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(ctx.status).toBe(400)
    expect(mockBroadcast).not.toHaveBeenCalled()
  })

  it('400 when body exceeds 300 chars', async () => {
    const handler = getHandler('/api/admin/push/send', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { title: 'Hi', body: 'B'.repeat(301) } },
      state: { user: {} },
    }
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(ctx.status).toBe(400)
  })

  it('forwards trimmed title/body, optional url, bypass flags to service', async () => {
    mockBroadcast.mockResolvedValue({ totalTargets: 10, delivered: 9, failed: 1, errors: ['x: err'] })
    const handler = getHandler('/api/admin/push/send', 'POST')
    const ctx: Record<string, unknown> = {
      request: {
        body: {
          title: '  Hello  ',
          body: '  Body text  ',
          url: '/matches',
          bypassQuietHours: true,
          bypassRateLimit: false,
        },
      },
      state: { user: {} },
    }
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(mockBroadcast).toHaveBeenCalledWith('admin-1', {
      title: 'Hello',
      body: 'Body text',
      url: '/matches',
      bypassQuietHours: true,
      bypassRateLimit: false,
    })
    expect(ctx.body).toEqual({ totalTargets: 10, delivered: 9, failed: 1, errors: ['x: err'] })
  })

  it('treats empty url string as undefined', async () => {
    mockBroadcast.mockResolvedValue({ totalTargets: 0, delivered: 0, failed: 0, errors: [] })
    const handler = getHandler('/api/admin/push/send', 'POST')
    const ctx: Record<string, unknown> = {
      request: { body: { title: 'T', body: 'B', url: '   ' } },
      state: { user: {} },
    }
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(mockBroadcast).toHaveBeenCalledWith('admin-1', expect.objectContaining({ url: undefined }))
  })
})
