import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../services/teams.service.js'
import type { TeamInput } from '../types/index.js'

const adminRouter = new Router({ prefix: '/api/admin' })

adminRouter.use(authMiddleware)
adminRouter.use(adminMiddleware)

adminRouter.get('/teams', async (ctx) => {
  ctx.body = await getTeams()
})

adminRouter.get('/teams/:id', async (ctx) => {
  ctx.body = await getTeamById(ctx.params['id'] as string)
})

adminRouter.post('/teams', async (ctx) => {
  const input = ctx.request.body as TeamInput
  ctx.status = 201
  ctx.body = await createTeam(input)
})

adminRouter.put('/teams/:id', async (ctx) => {
  const input = ctx.request.body as Partial<TeamInput>
  ctx.body = await updateTeam(ctx.params['id'] as string, input)
})

adminRouter.delete('/teams/:id', async (ctx) => {
  await deleteTeam(ctx.params['id'] as string)
  ctx.status = 204
})

export { adminRouter }
