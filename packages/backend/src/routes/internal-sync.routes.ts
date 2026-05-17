import Router from '@koa/router'
import { serviceTokenMiddleware } from '../middleware/service-token.middleware.js'
import { getSyncState, markSyncStarted, markSyncFinished, incrementApiCalls, hasLiveMatch, markPlayerSyncFinished, markTransfermarktSyncFinished } from '../services/sync-state.service.js'
import { shouldRunSync } from '../services/sync-gate.js'
import { runAllLeagues } from '../services/sync-runner.js'
import { syncAllMatchOdds } from '../services/polymarket.service.js'
import { syncPlayers } from '../services/player-sync.service.js'
import { syncTransfermarktValues } from '../services/transfermarkt.service.js'
import { buildConfig, createFootballApiClient } from '../services/football-api.service.js'

const internalSyncRouter = new Router({ prefix: '/api/internal/sync' })

internalSyncRouter.use(serviceTokenMiddleware)

internalSyncRouter.post('/tick', async (ctx) => {
  const state = await getSyncState()

  const limit = Number(process.env['FOOTBALL_API_DAILY_LIMIT'] ?? '100')
  if (state.apiCallsToday >= limit) {
    ctx.body = { skipped: true, reason: 'daily api limit reached' }
    return
  }

  const hasLive = await hasLiveMatch()
  const decision = shouldRunSync(state.mode, state.lastSuccessfulSyncAt, hasLive, new Date())

  if (!decision.run) {
    ctx.body = { skipped: true, reason: decision.reason }
    return
  }

  const claimed = await markSyncStarted()
  if (!claimed) {
    ctx.body = { skipped: true, reason: 'sync already in progress' }
    return
  }

  try {
    const results = await runAllLeagues(state.mode)
    const totalApiCalls = results.length * 2
    await markSyncFinished(true)
    await incrementApiCalls(totalApiCalls)
    ctx.body = { synced: true, results }
  } catch (err) {
    await markSyncFinished(false)
    throw err
  }
})

internalSyncRouter.post('/polymarket-tick', async (ctx) => {
  const state = await getSyncState()
  if (!state.polymarketSyncEnabled) {
    ctx.body = { skipped: true, reason: 'polymarket sync disabled' }
    return
  }
  const result = await syncAllMatchOdds()
  ctx.body = result
})

const PLAYER_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

internalSyncRouter.post('/player-tick', async (ctx) => {
  const state = await getSyncState()
  if (!state.playerSyncEnabled) {
    ctx.body = { skipped: true, reason: 'player sync disabled' }
    return
  }

  if (state.lastPlayerSyncAt) {
    const elapsed = Date.now() - state.lastPlayerSyncAt.getTime()
    if (elapsed < PLAYER_SYNC_INTERVAL_MS) {
      ctx.body = { skipped: true, reason: 'player sync ran less than 24h ago' }
      return
    }
  }

  const config = buildConfig()
  const client = createFootballApiClient(config)
  const result = await syncPlayers(client)
  await markPlayerSyncFinished()
  ctx.body = { synced: true, result }
})

const TRANSFERMARKT_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

internalSyncRouter.post('/transfermarkt-tick', async (ctx) => {
  const state = await getSyncState()
  if (!state.transfermarktSyncEnabled) {
    ctx.body = { skipped: true, reason: 'transfermarkt sync disabled' }
    return
  }

  if (state.lastTransfermarktSyncAt) {
    const elapsed = Date.now() - state.lastTransfermarktSyncAt.getTime()
    if (elapsed < TRANSFERMARKT_SYNC_INTERVAL_MS) {
      ctx.body = { skipped: true, reason: 'transfermarkt sync ran less than 24h ago' }
      return
    }
  }

  const result = await syncTransfermarktValues()
  await markTransfermarktSyncFinished()
  ctx.body = { synced: true, result }
})

export { internalSyncRouter }
