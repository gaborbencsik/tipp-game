import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser, updateProfile } from '../services/user.service.js'

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

export { router as authRouter }
