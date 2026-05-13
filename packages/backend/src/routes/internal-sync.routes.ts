import Router from '@koa/router'
import { serviceTokenMiddleware } from '../middleware/service-token.middleware.js'
import { getSyncState, markSyncStarted, markSyncFinished, incrementApiCalls, hasLiveMatch } from '../services/sync-state.service.js'
import { shouldRunSync } from '../services/sync-gate.js'
import { runAllLeagues } from '../services/sync-runner.js'
import { syncAllMatchOdds } from '../services/polymarket.service.js'

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

export { internalSyncRouter }
