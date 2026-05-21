import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getGlobalConfig } from '../services/scoring-config.service.js'

const router = new Router()

router.get('/api/scoring-config/default', authMiddleware, async (ctx) => {
  ctx.body = await getGlobalConfig()
})

export { router as scoringConfigRouter }
