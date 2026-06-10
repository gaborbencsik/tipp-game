import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { withHttpCache } from '../middleware/http-cache.middleware.js'
import { getLeaderboard } from '../services/leaderboard.service.js'

const router = new Router()

router.get('/api/leaderboard', authMiddleware, withHttpCache({ maxAge: 0, swr: 30 }), async (ctx) => {
  ctx.body = await getLeaderboard()
})

export { router as leaderboardRouter }
