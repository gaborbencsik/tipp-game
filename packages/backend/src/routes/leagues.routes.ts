import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'
import { getFavoritesForLeague } from '../services/league-favorites.service.js'

const router = new Router()

router.get('/api/leagues/:leagueId/favorites-summary', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const leagueId = ctx.params['leagueId']
  if (typeof leagueId !== 'string' || leagueId.length === 0) {
    ctx.status = 400
    ctx.body = { error: 'leagueId is required' }
    return
  }
  const members = await getFavoritesForLeague(leagueId, dbUser.id)
  ctx.body = { members }
})

export { router as leaguesRouter }
