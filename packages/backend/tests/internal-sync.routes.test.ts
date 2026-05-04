import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetSyncState, mockMarkSyncStarted, mockMarkSyncFinished, mockIncrementApiCalls, mockHasLiveMatch } = vi.hoisted(() => ({
  mockGetSyncState: vi.fn(),
  mockMarkSyncStarted: vi.fn(),
  mockMarkSyncFinished: vi.fn(),
  mockIncrementApiCalls: vi.fn(),
  mockHasLiveMatch: vi.fn(),
}))

const { mockRunAllLeagues } = vi.hoisted(() => ({
  mockRunAllLeagues: vi.fn(),
}))

const { mockServiceTokenMiddleware } = vi.hoisted(() => ({
  mockServiceTokenMiddleware: vi.fn(async (_ctx: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('../src/services/sync-state.service.js', () => ({
  getSyncState: mockGetSyncState,
  markSyncStarted: mockMarkSyncStarted,
  markSyncFinished: mockMarkSyncFinished,
  incrementApiCalls: mockIncrementApiCalls,
  hasLiveMatch: mockHasLiveMatch,
}))

vi.mock('../src/services/sync-runner.js', () => ({
  runAllLeagues: mockRunAllLeagues,
}))

vi.mock('../src/middleware/service-token.middleware.js', () => ({
  serviceTokenMiddleware: mockServiceTokenMiddleware,
}))

import { internalSyncRouter } from '../src/routes/internal-sync.routes.js'

function getTickHandler(): (ctx: any, next: () => Promise<void>) => Promise<void> {
  const matched = internalSyncRouter.match('/api/internal/sync/tick', 'POST')
  const layers = matched.pathAndMethod
  const layer = layers[layers.length - 1]
  return layer.stack[layer.stack.length - 1]
}

describe('POST /api/internal/sync/tick', () => {
  const originalEnv = process.env['FOOTBALL_API_DAILY_LIMIT']

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env['FOOTBALL_API_DAILY_LIMIT']
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['FOOTBALL_API_DAILY_LIMIT'] = originalEnv
    } else {
      delete process.env['FOOTBALL_API_DAILY_LIMIT']
    }
  })

  it('skips when mode is off', async () => {
    mockGetSyncState.mockResolvedValue({
      mode: 'off', lastSuccessfulSyncAt: null, apiCallsToday: 0, apiCallsDate: null, syncInProgress: false,
    })
    mockHasLiveMatch.mockResolvedValue(false)

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(ctx.body).toEqual({ skipped: true, reason: 'sync disabled' })
    expect(mockRunAllLeagues).not.toHaveBeenCalled()
  })

  it('skips when daily API limit reached', async () => {
    process.env['FOOTBALL_API_DAILY_LIMIT'] = '50'
    mockGetSyncState.mockResolvedValue({
      mode: 'adaptive', lastSuccessfulSyncAt: null, apiCallsToday: 50, apiCallsDate: '2026-06-15', syncInProgress: false,
    })

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(ctx.body).toEqual({ skipped: true, reason: 'daily api limit reached' })
  })

  it('skips when interval not elapsed', async () => {
    mockGetSyncState.mockResolvedValue({
      mode: 'final_only', lastSuccessfulSyncAt: new Date(), apiCallsToday: 0, apiCallsDate: '2026-06-15', syncInProgress: false,
    })
    mockHasLiveMatch.mockResolvedValue(false)

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect((ctx.body as any).skipped).toBe(true)
    expect((ctx.body as any).reason).toContain('interval not elapsed')
  })

  it('skips when sync already in progress', async () => {
    mockGetSyncState.mockResolvedValue({
      mode: 'full_live', lastSuccessfulSyncAt: new Date(Date.now() - 5 * 60 * 1000), apiCallsToday: 0, apiCallsDate: '2026-06-15', syncInProgress: false,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(false)

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(ctx.body).toEqual({ skipped: true, reason: 'sync already in progress' })
  })

  it('runs sync when all gates pass', async () => {
    mockGetSyncState.mockResolvedValue({
      mode: 'adaptive', lastSuccessfulSyncAt: new Date(Date.now() - 20 * 60 * 1000), apiCallsToday: 5, apiCallsDate: '2026-06-15', syncInProgress: false,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockResolvedValue([{ teamsUpserted: 2, fixturesUpserted: 10, resultsUpserted: 3, errors: [], partial: false }])
    mockMarkSyncFinished.mockResolvedValue(undefined)
    mockIncrementApiCalls.mockResolvedValue(undefined)

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect((ctx.body as any).synced).toBe(true)
    expect((ctx.body as any).results).toHaveLength(1)
    expect(mockMarkSyncFinished).toHaveBeenCalledWith(true)
    expect(mockIncrementApiCalls).toHaveBeenCalledWith(2)
  })

  it('marks sync as failed when runAllLeagues throws', async () => {
    mockGetSyncState.mockResolvedValue({
      mode: 'full_live', lastSuccessfulSyncAt: new Date(Date.now() - 5 * 60 * 1000), apiCallsToday: 0, apiCallsDate: '2026-06-15', syncInProgress: false,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockRejectedValue(new Error('API down'))
    mockMarkSyncFinished.mockResolvedValue(undefined)

    const ctx: Record<string, unknown> = { body: undefined }

    await expect(getTickHandler()(ctx, async () => {})).rejects.toThrow('API down')
    expect(mockMarkSyncFinished).toHaveBeenCalledWith(false)
  })
})
