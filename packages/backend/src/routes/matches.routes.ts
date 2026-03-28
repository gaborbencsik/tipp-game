import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getMatches } from '../services/matches.service.js'
import type { MatchesFilters, MatchStage, MatchStatus } from '../types/index.js'

const router = new Router()

router.get('/api/matches', authMiddleware, async (ctx) => {
  const { stage, status } = ctx.query as Record<string, string | undefined>
  const filters: MatchesFilters = {
    ...(stage ? { stage: stage as MatchStage } : {}),
    ...(status ? { status: status as MatchStatus } : {}),
  }
  ctx.body = await getMatches(filters)
})

export { router as matchesRouter }
