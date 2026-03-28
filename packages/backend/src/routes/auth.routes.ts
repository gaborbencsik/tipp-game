import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'

const router = new Router()

router.post('/api/auth/me', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = dbUser
})

export { router as authRouter }
