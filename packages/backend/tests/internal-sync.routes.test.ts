import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetSyncState, mockMarkSyncStarted, mockMarkSyncFinished, mockIncrementApiCalls, mockHasLiveMatch, mockMarkPlayerSyncFinished } = vi.hoisted(() => ({
  mockGetSyncState: vi.fn(),
  mockMarkSyncStarted: vi.fn(),
  mockMarkSyncFinished: vi.fn(),
  mockIncrementApiCalls: vi.fn(),
  mockHasLiveMatch: vi.fn(),
  mockMarkPlayerSyncFinished: vi.fn(),
}))

const { mockRunAllLeagues } = vi.hoisted(() => ({
  mockRunAllLeagues: vi.fn(),
}))

const { mockSyncPlayers } = vi.hoisted(() => ({
  mockSyncPlayers: vi.fn(),
}))

const { mockBuildConfig, mockCreateFootballApiClient } = vi.hoisted(() => ({
  mockBuildConfig: vi.fn(() => ({})),
  mockCreateFootballApiClient: vi.fn(() => ({})),
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
  markPlayerSyncFinished: mockMarkPlayerSyncFinished,
  markPolymarketSyncFinished: vi.fn(),
  markTransfermarktSyncFinished: vi.fn(),
}))

vi.mock('../src/services/sync-runner.js', () => ({
  runAllLeagues: mockRunAllLeagues,
}))

vi.mock('../src/services/player-sync.service.js', () => ({
  syncPlayers: mockSyncPlayers,
}))

vi.mock('../src/services/polymarket.service.js', () => ({
  syncAllMatchOdds: vi.fn(),
}))

vi.mock('../src/services/transfermarkt.service.js', () => ({
  syncTransfermarktValues: vi.fn(),
}))

vi.mock('../src/services/football-api.service.js', () => ({
  buildConfig: mockBuildConfig,
  createFootballApiClient: mockCreateFootballApiClient,
  FootballApiRateLimitError: class extends Error {},
}))

vi.mock('../src/middleware/service-token.middleware.js', () => ({
  serviceTokenMiddleware: mockServiceTokenMiddleware,
}))

import { internalSyncRouter } from '../src/routes/internal-sync.routes.js'

function getHandler(path: string): (ctx: any, next: () => Promise<void>) => Promise<void> {
  const matched = internalSyncRouter.match(path, 'POST')
  const layers = matched.pathAndMethod
  const layer = layers[layers.length - 1]
  return layer.stack[layer.stack.length - 1]
}

function getTickHandler(): (ctx: any, next: () => Promise<void>) => Promise<void> {
  return getHandler('/api/internal/sync/tick')
}

const BASE_STATE = {
  mode: 'adaptive' as const,
  lastSuccessfulSyncAt: new Date(Date.now() - 20 * 60 * 1000),
  apiCallsToday: 5,
  apiCallsDate: '2026-06-15',
  syncInProgress: false,
  polymarketSyncEnabled: false,
  lastPolymarketSyncAt: null,
  playerSyncEnabled: false,
  lastPlayerSyncAt: null,
  transfermarktSyncEnabled: false,
  lastTransfermarktSyncAt: null,
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
      ...BASE_STATE, mode: 'off', lastSuccessfulSyncAt: null, apiCallsToday: 0, apiCallsDate: null,
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
      ...BASE_STATE, lastSuccessfulSyncAt: null, apiCallsToday: 50,
    })

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(ctx.body).toEqual({ skipped: true, reason: 'daily api limit reached' })
  })

  it('skips when interval not elapsed', async () => {
    mockGetSyncState.mockResolvedValue({
      ...BASE_STATE, mode: 'final_only', lastSuccessfulSyncAt: new Date(), apiCallsToday: 0,
    })
    mockHasLiveMatch.mockResolvedValue(false)

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect((ctx.body as any).skipped).toBe(true)
    expect((ctx.body as any).reason).toContain('interval not elapsed')
  })

  it('skips when sync already in progress', async () => {
    mockGetSyncState.mockResolvedValue({
      ...BASE_STATE, mode: 'full_live', lastSuccessfulSyncAt: new Date(Date.now() - 5 * 60 * 1000), apiCallsToday: 0,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(false)

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(ctx.body).toEqual({ skipped: true, reason: 'sync already in progress' })
  })

  it('runs sync when all gates pass', async () => {
    mockGetSyncState.mockResolvedValue({ ...BASE_STATE })
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
      ...BASE_STATE, mode: 'full_live', lastSuccessfulSyncAt: new Date(Date.now() - 5 * 60 * 1000), apiCallsToday: 0,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockRejectedValue(new Error('API down'))
    mockMarkSyncFinished.mockResolvedValue(undefined)

    const ctx: Record<string, unknown> = { body: undefined }

    await expect(getTickHandler()(ctx, async () => {})).rejects.toThrow('API down')
    expect(mockMarkSyncFinished).toHaveBeenCalledWith(false)
  })

  it('runs player sync after league sync when due', async () => {
    mockGetSyncState.mockResolvedValue({
      ...BASE_STATE, playerSyncEnabled: true, lastPlayerSyncAt: null,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockResolvedValue([])
    mockSyncPlayers.mockResolvedValue({ inserted: 3, updated: 1, statsUpserted: 0, skipped: 0, errors: [] })

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(mockSyncPlayers).toHaveBeenCalled()
    expect(mockMarkPlayerSyncFinished).toHaveBeenCalled()
    expect((ctx.body as any).playerSync).toEqual({
      synced: true,
      result: { inserted: 3, updated: 1, statsUpserted: 0, skipped: 0, errors: [] },
    })
  })

  it('skips player sync when disabled', async () => {
    mockGetSyncState.mockResolvedValue({ ...BASE_STATE, playerSyncEnabled: false })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockResolvedValue([])

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(mockSyncPlayers).not.toHaveBeenCalled()
    expect((ctx.body as any).playerSync).toEqual({ skipped: true, reason: 'player sync disabled' })
  })

  it('skips player sync when ran less than 24h ago', async () => {
    mockGetSyncState.mockResolvedValue({
      ...BASE_STATE, playerSyncEnabled: true, lastPlayerSyncAt: new Date(Date.now() - 60 * 60 * 1000),
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockResolvedValue([])

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect(mockSyncPlayers).not.toHaveBeenCalled()
    expect((ctx.body as any).playerSync).toEqual({ skipped: true, reason: 'player sync ran less than 24h ago' })
  })

  it('captures player sync error without failing tick', async () => {
    mockGetSyncState.mockResolvedValue({
      ...BASE_STATE, playerSyncEnabled: true, lastPlayerSyncAt: null,
    })
    mockHasLiveMatch.mockResolvedValue(false)
    mockMarkSyncStarted.mockResolvedValue(true)
    mockRunAllLeagues.mockResolvedValue([])
    mockSyncPlayers.mockRejectedValue(new Error('player API timeout'))

    const ctx: Record<string, unknown> = { body: undefined }
    await getTickHandler()(ctx, async () => {})

    expect((ctx.body as any).synced).toBe(true)
    expect((ctx.body as any).playerSync).toEqual({ error: 'player API timeout' })
  })
})
