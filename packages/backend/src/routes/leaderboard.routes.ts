import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getLeaderboard } from '../services/leaderboard.service.js'

const router = new Router()

router.get('/api/leaderboard', authMiddleware, async (ctx) => {
  ctx.body = await getLeaderboard()
})

export { router as leaderboardRouter }
