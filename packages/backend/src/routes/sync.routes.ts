import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { runAllLeagues, getConfiguredLeagueDescriptors } from '../services/sync-runner.js'
import { syncAllMatchOdds } from '../services/polymarket.service.js'
import { syncPlayers } from '../services/player-sync.service.js'
import { syncTransfermarktValues } from '../services/transfermarkt.service.js'
import { buildConfig, createFootballApiClient } from '../services/football-api.service.js'
import { runRawStatsCollection } from '../services/insights/raw-stats-batch.service.js'
import { runInsightsBatch, runTranslationsBatch, getInsightsUsage } from '../services/insights/batch.service.js'
import { getSyncState, setSyncMode, setPolymarketSyncEnabled, setPlayerSyncEnabled, setTransfermarktSyncEnabled, setRawStatsSyncEnabled, setRawStatsSkipFresh, setInsightsSyncEnabled, markSyncStarted, markSyncFinished, incrementApiCalls, markPolymarketSyncFinished, markPlayerSyncFinished, markTransfermarktSyncFinished, markRawStatsSyncFinished, markInsightsSyncFinished } from '../services/sync-state.service.js'
import type { SyncMode } from '../types/index.js'

const VALID_SYNC_MODES: readonly SyncMode[] = ['off', 'final_only', 'adaptive', 'full_live']

const syncRouter = new Router({ prefix: '/api/admin/sync' })

syncRouter.use(authMiddleware)
syncRouter.use(adminMiddleware)

syncRouter.get('/settings', async (ctx) => {
  const state = await getSyncState()
  ctx.body = {
    mode: state.mode,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    apiCallsToday: state.apiCallsToday,
    syncInProgress: state.syncInProgress,
    polymarketSyncEnabled: state.polymarketSyncEnabled,
    lastPolymarketSyncAt: state.lastPolymarketSyncAt,
    playerSyncEnabled: state.playerSyncEnabled,
    lastPlayerSyncAt: state.lastPlayerSyncAt,
    transfermarktSyncEnabled: state.transfermarktSyncEnabled,
    lastTransfermarktSyncAt: state.lastTransfermarktSyncAt,
    rawStatsSyncEnabled: state.rawStatsSyncEnabled,
    lastRawStatsSyncAt: state.lastRawStatsSyncAt,
    rawStatsSkipFresh: state.rawStatsSkipFresh,
    insightsSyncEnabled: state.insightsSyncEnabled,
    lastInsightsSyncAt: state.lastInsightsSyncAt,
    configuredLeagues: await getConfiguredLeagueDescriptors(),
  }
})

syncRouter.put('/settings', async (ctx) => {
  const { mode, polymarketSyncEnabled, playerSyncEnabled, transfermarktSyncEnabled, rawStatsSyncEnabled, rawStatsSkipFresh, insightsSyncEnabled } = ctx.request.body as { mode?: string; polymarketSyncEnabled?: boolean; playerSyncEnabled?: boolean; transfermarktSyncEnabled?: boolean; rawStatsSyncEnabled?: boolean; rawStatsSkipFresh?: boolean; insightsSyncEnabled?: boolean }

  if (mode !== undefined) {
    if (!(VALID_SYNC_MODES as readonly string[]).includes(mode)) {
      ctx.status = 400
      ctx.body = { error: `Invalid mode. Valid modes: ${VALID_SYNC_MODES.join(', ')}` }
      return
    }
    await setSyncMode(mode as SyncMode)
  }

  if (polymarketSyncEnabled !== undefined) {
    await setPolymarketSyncEnabled(polymarketSyncEnabled)
  }

  if (playerSyncEnabled !== undefined) {
    await setPlayerSyncEnabled(playerSyncEnabled)
  }

  if (transfermarktSyncEnabled !== undefined) {
    await setTransfermarktSyncEnabled(transfermarktSyncEnabled)
  }

  if (rawStatsSyncEnabled !== undefined) {
    await setRawStatsSyncEnabled(rawStatsSyncEnabled)
  }

  if (rawStatsSkipFresh !== undefined) {
    await setRawStatsSkipFresh(rawStatsSkipFresh)
  }

  if (insightsSyncEnabled !== undefined) {
    await setInsightsSyncEnabled(insightsSyncEnabled)
  }

  const state = await getSyncState()
  ctx.body = {
    mode: state.mode,
    polymarketSyncEnabled: state.polymarketSyncEnabled,
    playerSyncEnabled: state.playerSyncEnabled,
    transfermarktSyncEnabled: state.transfermarktSyncEnabled,
    rawStatsSyncEnabled: state.rawStatsSyncEnabled,
    rawStatsSkipFresh: state.rawStatsSkipFresh,
    insightsSyncEnabled: state.insightsSyncEnabled,
  }
})

syncRouter.post('/run', async (ctx) => {
  const state = await getSyncState()
  if (state.mode === 'off') {
    ctx.status = 400
    ctx.body = { error: 'Sync is disabled. Change mode first.' }
    return
  }

  try {
    await markSyncStarted()
    const results = await runAllLeagues(state.mode)
    const totalApiCalls = results.length * 2
    await markSyncFinished(true)
    await incrementApiCalls(totalApiCalls)
    ctx.body = { results }
  } catch (err) {
    await markSyncFinished(false)
    throw err
  }
})

syncRouter.post('/polymarket-run', async (ctx) => {
  const result = await syncAllMatchOdds()
  await markPolymarketSyncFinished()
  ctx.body = result
})

syncRouter.post('/players-run', async (ctx) => {
  const config = buildConfig()
  const client = createFootballApiClient(config)
  const result = await syncPlayers(client)
  await markPlayerSyncFinished()
  ctx.body = result
})

syncRouter.post('/transfermarkt-run', async (ctx) => {
  const result = await syncTransfermarktValues()
  await markTransfermarktSyncFinished()
  ctx.body = result
})

syncRouter.post('/raw-stats-run', async (ctx) => {
  const state = await getSyncState()
  const config = buildConfig()
  const client = createFootballApiClient(config)
  const result = await runRawStatsCollection(client, { skipFresh: state.rawStatsSkipFresh })
  await markRawStatsSyncFinished()
  if (result.apiCalls > 0) await incrementApiCalls(result.apiCalls)
  ctx.body = result
})

syncRouter.post('/insights-run', async (ctx) => {
  const { matchId } = (ctx.request.body ?? {}) as { matchId?: string }
  const result = await runInsightsBatch(matchId)
  await markInsightsSyncFinished()
  ctx.body = result
})

syncRouter.post('/insights-translate', async (ctx) => {
  const { matchId } = (ctx.request.body ?? {}) as { matchId?: string }
  ctx.body = await runTranslationsBatch(matchId)
})

syncRouter.get('/insights-usage', async (ctx) => {
  ctx.body = await getInsightsUsage()
})

export { syncRouter }
