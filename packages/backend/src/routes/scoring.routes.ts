import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { withHttpCache } from '../middleware/http-cache.middleware.js'
import { getScoringExplainer } from '../services/scoring-explainer.service.js'

const router = new Router()

router.get('/api/scoring/explainer', authMiddleware, withHttpCache({ maxAge: 600, swr: 1200 }), async (ctx) => {
  ctx.body = await getScoringExplainer(ctx.state.user.supabaseId)
})

export { router as scoringRouter }
