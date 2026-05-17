import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { getSyncState, setSyncMode, setPolymarketSyncEnabled, setPlayerSyncEnabled, setTransfermarktSyncEnabled, markSyncStarted, markSyncFinished, incrementApiCalls, markPlayerSyncFinished, markTransfermarktSyncFinished } from '../services/sync-state.service.js'
import { runAllLeagues } from '../services/sync-runner.js'
import { syncAllMatchOdds } from '../services/polymarket.service.js'
import { syncPlayers } from '../services/player-sync.service.js'
import { syncTransfermarktValues } from '../services/transfermarkt.service.js'
import { buildConfig, createFootballApiClient } from '../services/football-api.service.js'
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
    playerSyncEnabled: state.playerSyncEnabled,
    lastPlayerSyncAt: state.lastPlayerSyncAt,
    transfermarktSyncEnabled: state.transfermarktSyncEnabled,
    lastTransfermarktSyncAt: state.lastTransfermarktSyncAt,
  }
})

syncRouter.put('/settings', async (ctx) => {
  const { mode, polymarketSyncEnabled, playerSyncEnabled, transfermarktSyncEnabled } = ctx.request.body as { mode?: string; polymarketSyncEnabled?: boolean; playerSyncEnabled?: boolean; transfermarktSyncEnabled?: boolean }

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

  const state = await getSyncState()
  ctx.body = { mode: state.mode, polymarketSyncEnabled: state.polymarketSyncEnabled, playerSyncEnabled: state.playerSyncEnabled, transfermarktSyncEnabled: state.transfermarktSyncEnabled }
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

export { syncRouter }
