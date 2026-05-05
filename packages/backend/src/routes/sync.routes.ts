import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { getSyncState, setSyncMode, markSyncStarted, markSyncFinished, incrementApiCalls } from '../services/sync-state.service.js'
import { runAllLeagues } from '../services/sync-runner.js'
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
  }
})

syncRouter.put('/settings', async (ctx) => {
  const { mode } = ctx.request.body as { mode?: string }

  if (!mode || !(VALID_SYNC_MODES as readonly string[]).includes(mode)) {
    ctx.status = 400
    ctx.body = { error: `Invalid mode. Valid modes: ${VALID_SYNC_MODES.join(', ')}` }
    return
  }

  await setSyncMode(mode as SyncMode)
  const state = await getSyncState()
  ctx.body = { mode: state.mode }
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

export { syncRouter }
