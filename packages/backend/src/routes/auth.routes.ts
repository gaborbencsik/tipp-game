import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser, updateProfile, completeOnboarding } from '../services/user.service.js'
import { getFavoritesForUser, setFavorite } from '../services/user-league-favorites.service.js'

const router = new Router()

router.post('/api/auth/me', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = dbUser
})

router.put('/api/users/me', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { displayName?: unknown }
  const displayName = body.displayName
  if (typeof displayName !== 'string' || displayName.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'displayName is required' }
    return
  }
  const updated = await updateProfile(dbUser.id, displayName.trim())
  ctx.body = updated
})

router.put('/api/users/me/onboarding', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const updated = await completeOnboarding(dbUser.id)
  ctx.body = updated
})

router.get('/api/users/me/league-favorites', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const favorites = await getFavoritesForUser(dbUser.id)
  ctx.body = favorites
})

router.put('/api/users/me/league-favorites/:leagueId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const { leagueId } = ctx.params
  const body = ctx.request.body as { teamId?: unknown }
  if (typeof body.teamId !== 'string' || body.teamId.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'teamId is required' }
    return
  }
  const favorite = await setFavorite(dbUser.id, leagueId, body.teamId)
  ctx.body = favorite
})

export { router as authRouter }
