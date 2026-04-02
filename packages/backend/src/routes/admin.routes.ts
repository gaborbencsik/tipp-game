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
import {
  createMatch,
  updateMatch,
  deleteMatch,
  setResult,
} from '../services/matches.service.js'
import { upsertUser } from '../services/user.service.js'
import type { TeamInput, MatchInput } from '../types/index.js'

const adminRouter = new Router({ prefix: '/api/admin' })

adminRouter.use(authMiddleware)
adminRouter.use(adminMiddleware)

// ─── Teams ────────────────────────────────────────────────────────────────────

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

// ─── Matches ──────────────────────────────────────────────────────────────────

adminRouter.post('/matches', async (ctx) => {
  const input = ctx.request.body as MatchInput
  ctx.status = 201
  ctx.body = await createMatch(input)
})

adminRouter.put('/matches/:id', async (ctx) => {
  const input = ctx.request.body as Partial<MatchInput>
  ctx.body = await updateMatch(ctx.params['id'] as string, input)
})

adminRouter.delete('/matches/:id', async (ctx) => {
  await deleteMatch(ctx.params['id'] as string)
  ctx.status = 204
})

adminRouter.post('/matches/:id/result', async (ctx) => {
  const { homeGoals, awayGoals } = ctx.request.body as { homeGoals: number; awayGoals: number }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await setResult(ctx.params['id'] as string, homeGoals, awayGoals, dbUser.id)
})

export { adminRouter }

