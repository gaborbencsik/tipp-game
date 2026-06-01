import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getScoringExplainer } from '../services/scoring-explainer.service.js'

const router = new Router()

router.get('/api/scoring/explainer', authMiddleware, async (ctx) => {
  ctx.body = await getScoringExplainer(ctx.state.user.supabaseId)
})

export { router as scoringRouter }
