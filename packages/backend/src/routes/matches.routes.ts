import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { createRateLimit } from '../middleware/rateLimit.middleware.js'
import { getMatches } from '../services/matches.service.js'
import { getLeagues } from '../services/leagues.service.js'
import { getMatchPredictions } from '../services/predictions.service.js'
import { getTeamsForLeague } from '../services/user-league-favorites.service.js'
import { getLatestOdds } from '../services/polymarket.service.js'
import { getVirtualPointsForUserInGroup } from '../services/virtual-points.service.js'
import { upsertUser } from '../services/user.service.js'
import {
  revealInsight,
  isMatchRevealed,
  MatchNotFoundError,
} from '../services/insights/reveal.service.js'
import type { MatchesFilters, MatchStage, MatchStatus } from '../types/index.js'

const router = new Router()

const revealRateLimit = createRateLimit({ windowMs: 60_000, max: 10 })

router.get('/api/matches', authMiddleware, async (ctx) => {
  const { stage, status, leagueId } = ctx.query as Record<string, string | undefined>
  const rawLeagueIds = ctx.query['leagueIds']
  const leagueIds = Array.isArray(rawLeagueIds)
    ? rawLeagueIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : typeof rawLeagueIds === 'string' && rawLeagueIds.length > 0
      ? [rawLeagueIds]
      : undefined
  const filters: MatchesFilters = {
    ...(stage ? { stage: stage as MatchStage } : {}),
    ...(status ? { status: status as MatchStatus } : {}),
    ...(leagueId ? { leagueId } : {}),
    ...(leagueIds && leagueIds.length > 0 ? { leagueIds } : {}),
  }
  ctx.body = await getMatches(filters)
})

router.get('/api/leagues', authMiddleware, async (ctx) => {
  ctx.body = await getLeagues()
})

router.get('/api/matches/:matchId/predictions', authMiddleware, async (ctx) => {
  const groupId = typeof ctx.query['groupId'] === 'string' ? ctx.query['groupId'] : undefined
  ctx.body = await getMatchPredictions(ctx.params.matchId, groupId)
})

router.get('/api/leagues/:leagueId/teams', authMiddleware, async (ctx) => {
  ctx.body = await getTeamsForLeague(ctx.params.leagueId)
})

router.get('/api/matches/:matchId/odds', authMiddleware, async (ctx) => {
  try {
    const dbUser = await upsertUser(ctx.state.user)
    const [odds, revealed] = await Promise.all([
      getLatestOdds(ctx.params.matchId),
      isMatchRevealed(dbUser.id, ctx.params.matchId),
    ])
    ctx.body = { odds: odds ?? null, revealed }
  } catch {
    ctx.body = { odds: null, revealed: false }
  }
})

router.post('/api/matches/:matchId/insights/reveal', revealRateLimit, authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  try {
    ctx.body = await revealInsight(dbUser.id, ctx.params.matchId)
  } catch (err) {
    if (err instanceof MatchNotFoundError) {
      ctx.status = 404
      ctx.body = { error: 'Match not found' }
      return
    }
    throw err
  }
})

router.get('/api/matches/virtual-points', authMiddleware, async (ctx) => {
  const groupId = ctx.query['groupId']
  if (typeof groupId !== 'string' || groupId.length === 0) {
    ctx.status = 400
    ctx.body = { error: 'groupId query parameter is required' }
    return
  }
  const dbUser = await upsertUser(ctx.state.user)
  try {
    ctx.body = await getVirtualPointsForUserInGroup(groupId, dbUser.id)
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      ctx.status = (err as { status: number }).status
      ctx.body = { error: err.message }
      return
    }
    throw err
  }
})

export { router as matchesRouter }
