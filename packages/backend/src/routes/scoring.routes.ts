import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getScoringExplainer } from '../services/scoring-explainer.service.js'

const router = new Router()

router.get('/api/scoring/explainer', authMiddleware, async (ctx) => {
  const userId = ctx.state.user.id as string
  ctx.body = await getScoringExplainer(userId)
})

export { router as scoringRouter }
