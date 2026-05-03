import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { getSyncMode, setSyncMode, VALID_SYNC_MODES } from '../services/sync-config.js'
import { runSync } from '../services/sync.service.js'
import { buildConfig, createFootballApiClient } from '../services/football-api.service.js'
import type { SyncMode } from '../types/index.js'

const syncRouter = new Router({ prefix: '/api/admin/sync' })

syncRouter.use(authMiddleware)
syncRouter.use(adminMiddleware)

syncRouter.get('/settings', (ctx) => {
  ctx.body = { mode: getSyncMode() }
})

syncRouter.put('/settings', (ctx) => {
  const { mode } = ctx.request.body as { mode?: string }

  if (!mode || !(VALID_SYNC_MODES as readonly string[]).includes(mode)) {
    ctx.status = 400
    ctx.body = { error: `Invalid mode. Valid modes: ${VALID_SYNC_MODES.join(', ')}` }
    return
  }

  setSyncMode(mode as SyncMode)
  ctx.body = { mode: getSyncMode() }
})

syncRouter.post('/run', async (ctx) => {
  const mode = getSyncMode()
  if (mode === 'off') {
    ctx.status = 400
    ctx.body = { error: 'Sync is disabled. Change mode first.' }
    return
  }

  const config = buildConfig()
  const client = createFootballApiClient(config)

  const wcLeagueId = process.env['FOOTBALL_API_WC_LEAGUE_ID']
  const nbiLeagueId = process.env['FOOTBALL_API_NBI_LEAGUE_ID']
  const wcInternalId = process.env['FOOTBALL_INTERNAL_WC_LEAGUE_ID']
  const nbiInternalId = process.env['FOOTBALL_INTERNAL_NBI_LEAGUE_ID']

  const results = []

  if (wcLeagueId && wcInternalId) {
    const result = await runSync(
      Number(wcLeagueId),
      wcInternalId,
      2026,
      client,
      mode,
    )
    results.push(result)
  }

  if (nbiLeagueId && nbiInternalId) {
    const result = await runSync(
      Number(nbiLeagueId),
      nbiInternalId,
      2025,
      client,
      mode,
    )
    results.push(result)
  }

  if (results.length === 0) {
    ctx.status = 400
    ctx.body = { error: 'No leagues configured. Set FOOTBALL_INTERNAL_WC_LEAGUE_ID and/or FOOTBALL_INTERNAL_NBI_LEAGUE_ID.' }
    return
  }

  ctx.body = { results }
})

export { syncRouter }
