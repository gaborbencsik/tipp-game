import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { League } from '../src/types/index.js'

const {
  mockGetLeagues,
  mockArchiveLeague,
  mockRestoreLeague,
  mockUpsertUser,
  mockAuthMiddleware,
  mockAdminMiddleware,
} = vi.hoisted(() => ({
  mockGetLeagues: vi.fn(),
  mockArchiveLeague: vi.fn(),
  mockRestoreLeague: vi.fn(),
  mockUpsertUser: vi.fn(),
  mockAuthMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
  mockAdminMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('../src/services/leagues.service.js', () => ({
  getLeagues: mockGetLeagues,
  createLeague: vi.fn(),
  updateLeague: vi.fn(),
  deleteLeague: vi.fn(),
  archiveLeague: mockArchiveLeague,
  restoreLeague: mockRestoreLeague,
}))

vi.mock('../src/services/user.service.js', () => ({
  upsertUser: mockUpsertUser,
}))

vi.mock('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: mockAuthMiddleware,
}))

vi.mock('../src/middleware/admin.middleware.js', () => ({
  adminMiddleware: mockAdminMiddleware,
}))

import { adminRouter } from '../src/routes/admin.routes.js'

const ACTOR = { id: 'actor-uuid-99' }

const ACTIVE_LEAGUE: League = {
  id: 'league-uuid-1',
  name: 'World Cup 2026',
  shortName: 'WC2026',
  archivedAt: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}

const ARCHIVED_LEAGUE: League = { ...ACTIVE_LEAGUE, archivedAt: '2026-07-21T10:00:00.000Z' }

function getHandler(
  path: string,
  method: string,
): { stack: Array<(ctx: never, next: () => Promise<void>) => Promise<void>> } {
  const matched = adminRouter.match(path, method)
  const layers = matched.pathAndMethod
  return layers[layers.length - 1] as never
}

async function invoke(path: string, method: string, ctx: Record<string, unknown>): Promise<void> {
  const handler = getHandler(path, method)
  await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
}

describe('GET /api/admin/leagues', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('default → calls getLeagues with includeArchived false', async () => {
    mockGetLeagues.mockResolvedValue([ACTIVE_LEAGUE])
    const ctx: Record<string, unknown> = { query: {} }

    await invoke('/api/admin/leagues', 'GET', ctx)

    expect(mockGetLeagues).toHaveBeenCalledWith({ includeArchived: false })
    expect(ctx.body).toEqual([ACTIVE_LEAGUE])
  })

  it('?includeArchived=true → calls getLeagues with includeArchived true', async () => {
    mockGetLeagues.mockResolvedValue([ACTIVE_LEAGUE, ARCHIVED_LEAGUE])
    const ctx: Record<string, unknown> = { query: { includeArchived: 'true' } }

    await invoke('/api/admin/leagues', 'GET', ctx)

    expect(mockGetLeagues).toHaveBeenCalledWith({ includeArchived: true })
    expect(ctx.body).toHaveLength(2)
  })
})

describe('POST /api/admin/leagues/:id/archive', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUpsertUser.mockResolvedValue(ACTOR)
  })

  it('archives and returns updated league with actorId from upsertUser', async () => {
    mockArchiveLeague.mockResolvedValue(ARCHIVED_LEAGUE)
    const ctx: Record<string, unknown> = { params: { id: 'league-uuid-1' }, state: { user: {} } }

    await invoke('/api/admin/leagues/:id/archive', 'POST', ctx)

    expect(mockArchiveLeague).toHaveBeenCalledWith('league-uuid-1', ACTOR.id)
    expect((ctx.body as League).archivedAt).toBe(ARCHIVED_LEAGUE.archivedAt)
  })

  it('propagates 404 from service for unknown league', async () => {
    mockArchiveLeague.mockRejectedValue(Object.assign(new Error('League not found'), { status: 404 }))
    const ctx: Record<string, unknown> = { params: { id: 'nope' }, state: { user: {} } }

    await expect(invoke('/api/admin/leagues/:id/archive', 'POST', ctx)).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('POST /api/admin/leagues/:id/restore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockUpsertUser.mockResolvedValue(ACTOR)
  })

  it('restores and returns updated league', async () => {
    mockRestoreLeague.mockResolvedValue(ACTIVE_LEAGUE)
    const ctx: Record<string, unknown> = { params: { id: 'league-uuid-1' }, state: { user: {} } }

    await invoke('/api/admin/leagues/:id/restore', 'POST', ctx)

    expect(mockRestoreLeague).toHaveBeenCalledWith('league-uuid-1', ACTOR.id)
    expect((ctx.body as League).archivedAt).toBeNull()
  })

  it('propagates 404 from service for unknown league', async () => {
    mockRestoreLeague.mockRejectedValue(Object.assign(new Error('League not found'), { status: 404 }))
    const ctx: Record<string, unknown> = { params: { id: 'nope' }, state: { user: {} } }

    await expect(invoke('/api/admin/leagues/:id/restore', 'POST', ctx)).rejects.toMatchObject({
      status: 404,
    })
  })
})
