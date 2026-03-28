import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertPrediction, getPredictionsForUser } from '../services/predictions.service.js'
import type { PredictionInput } from '../types/index.js'

const router = new Router()

function isValidGoals(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 99
}

router.post('/api/predictions', authMiddleware, async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const { matchId, homeGoals, awayGoals } = body

  if (typeof matchId !== 'string' || !matchId) {
    ctx.status = 400
    ctx.body = { error: 'matchId is required' }
    return
  }
  if (!isValidGoals(homeGoals) || !isValidGoals(awayGoals)) {
    ctx.status = 400
    ctx.body = { error: 'homeGoals and awayGoals must be integers between 0 and 99' }
    return
  }

  const input: PredictionInput = { matchId, homeGoals, awayGoals }
  ctx.body = await upsertPrediction(ctx.state.user.supabaseId, input)
})

router.get('/api/users/:userId/predictions', authMiddleware, async (ctx) => {
  const { userId } = ctx.params
  ctx.body = await getPredictionsForUser(ctx.state.user.supabaseId, userId)
})

export { router as predictionsRouter }
