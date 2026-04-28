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
  getLeagues,
  createLeague,
  updateLeague,
  deleteLeague,
} from '../services/leagues.service.js'
import {
  getPlayers,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
} from '../services/players.service.js'
import {
  listGlobalTypes,
  createGlobalType,
  updateGlobalType,
  deactivateGlobalType,
} from '../services/global-special-types.service.js'
import { evaluateGlobalType } from '../services/special-prediction-evaluation.service.js'
import {
  createMatch,
  updateMatch,
  deleteMatch,
  setResult,
} from '../services/matches.service.js'
import {
  getUsers,
  updateUserRole,
  banUser,
} from '../services/admin-users.service.js'
import { upsertUser } from '../services/user.service.js'
import { getGlobalConfig, updateGlobalConfig } from '../services/scoring-config.service.js'
import { getWaitlistEntries, deleteWaitlistEntry, addWaitlistEntry, isValidEmail } from '../services/waitlist.service.js'
import type { MatchOutcome, TeamInput, MatchInput, ScoringConfigInput, PlayerInput, SpecialTypeInput, LeagueInput } from '../types/index.js'
import type { WaitlistFilters, WaitlistSource } from '../services/waitlist.service.js'

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

// ─── Leagues ─────────────────────────────────────────────────────────────────

adminRouter.get('/leagues', async (ctx) => {
  ctx.body = await getLeagues()
})

adminRouter.post('/leagues', async (ctx) => {
  const input = ctx.request.body as LeagueInput
  ctx.status = 201
  ctx.body = await createLeague(input)
})

adminRouter.put('/leagues/:id', async (ctx) => {
  const input = ctx.request.body as Partial<LeagueInput>
  ctx.body = await updateLeague(ctx.params['id'] as string, input)
})

adminRouter.delete('/leagues/:id', async (ctx) => {
  await deleteLeague(ctx.params['id'] as string)
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
  const { homeGoals, awayGoals, outcomeAfterDraw } = ctx.request.body as {
    homeGoals: number
    awayGoals: number
    outcomeAfterDraw?: MatchOutcome | null
  }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await setResult(ctx.params['id'] as string, homeGoals, awayGoals, dbUser.id, outcomeAfterDraw)
})

// ─── Users ────────────────────────────────────────────────────────────────────

adminRouter.get('/users', async (ctx) => {
  ctx.body = await getUsers()
})

adminRouter.put('/users/:id/role', async (ctx) => {
  const { role } = ctx.request.body as { role: 'user' | 'admin' }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await updateUserRole(ctx.params['id'] as string, role, dbUser.id)
})

adminRouter.put('/users/:id/ban', async (ctx) => {
  const { ban } = ctx.request.body as { ban: boolean }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await banUser(ctx.params['id'] as string, ban, dbUser.id)
})

// ─── Scoring config ───────────────────────────────────────────────────────────

adminRouter.get('/scoring-config', async (ctx) => {
  ctx.body = await getGlobalConfig()
})

adminRouter.put('/scoring-config', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const fields: Array<keyof ScoringConfigInput> = [
    'exactScore', 'correctWinnerAndDiff', 'correctWinner', 'correctDraw', 'correctOutcome', 'incorrect',
  ]
  for (const field of fields) {
    if (typeof body[field] !== 'number') {
      ctx.status = 400
      ctx.body = { error: `Field '${field}' must be a number` }
      return
    }
  }
  ctx.body = await updateGlobalConfig(body as unknown as ScoringConfigInput)
})

// ─── Players ─────────────────────────────────────────────────────────────────

adminRouter.get('/players', async (ctx) => {
  const teamId = typeof ctx.query['teamId'] === 'string' ? ctx.query['teamId'] : undefined
  ctx.body = await getPlayers(teamId)
})

adminRouter.get('/players/:id', async (ctx) => {
  ctx.body = await getPlayerById(ctx.params['id'] as string)
})

adminRouter.post('/players', async (ctx) => {
  const input = ctx.request.body as PlayerInput
  ctx.status = 201
  ctx.body = await createPlayer(input)
})

adminRouter.put('/players/:id', async (ctx) => {
  const input = ctx.request.body as Partial<PlayerInput>
  ctx.body = await updatePlayer(ctx.params['id'] as string, input)
})

adminRouter.delete('/players/:id', async (ctx) => {
  await deletePlayer(ctx.params['id'] as string)
  ctx.status = 204
})

// ─── Global Special Types ───────────────────────────────────────────────────

adminRouter.get('/global-special-types', async (ctx) => {
  ctx.body = await listGlobalTypes()
})

adminRouter.post('/global-special-types', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const input: SpecialTypeInput = {
    name: body.name as string,
    description: typeof body.description === 'string' ? body.description : undefined,
    inputType: body.inputType as 'text' | 'dropdown' | 'team_select',
    options: Array.isArray(body.options) ? body.options as string[] : undefined,
    deadline: body.deadline as string,
    points: body.points as number,
  }
  ctx.status = 201
  ctx.body = await createGlobalType(input)
})

adminRouter.put('/global-special-types/:typeId', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const input: Partial<SpecialTypeInput> = {}
  if (body.name !== undefined) (input as Record<string, unknown>).name = body.name
  if (body.description !== undefined) (input as Record<string, unknown>).description = body.description
  if (body.inputType !== undefined) (input as Record<string, unknown>).inputType = body.inputType
  if (body.options !== undefined) (input as Record<string, unknown>).options = body.options
  if (body.deadline !== undefined) (input as Record<string, unknown>).deadline = body.deadline
  if (body.points !== undefined) (input as Record<string, unknown>).points = body.points
  ctx.body = await updateGlobalType(ctx.params['typeId'] as string, input)
})

adminRouter.delete('/global-special-types/:typeId', async (ctx) => {
  await deactivateGlobalType(ctx.params['typeId'] as string)
  ctx.status = 204
})

adminRouter.put('/global-special-types/:typeId/answer', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  if (typeof body.correctAnswer !== 'string' || body.correctAnswer.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'correctAnswer is required' }
    return
  }
  ctx.body = await evaluateGlobalType(ctx.params['typeId'] as string, body.correctAnswer.trim())
})

// ─── Waitlist ────────────────────────────────────────────────────────────────

const VALID_WAITLIST_SOURCES: readonly WaitlistSource[] = ['hero', 'footer', 'admin'] as const

adminRouter.get('/waitlist', async (ctx) => {
  const query = ctx.query as Record<string, string | undefined>
  const source = VALID_WAITLIST_SOURCES.includes(query.source as WaitlistSource) ? query.source as WaitlistSource : undefined
  const search = typeof query.search === 'string' && query.search.trim().length > 0 ? query.search.trim() : undefined

  const filters: WaitlistFilters = {
    ...(source ? { source } : {}),
    ...(search ? { search } : {}),
  }

  ctx.body = await getWaitlistEntries(filters)
})

adminRouter.delete('/waitlist/:id', async (ctx) => {
  await deleteWaitlistEntry(ctx.params['id'] as string)
  ctx.status = 204
})

adminRouter.post('/waitlist', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const email = typeof body.email === 'string' ? body.email.trim() : ''

  if (!email || !isValidEmail(email)) {
    ctx.status = 400
    ctx.body = { error: 'Invalid email' }
    return
  }

  const rawSource = typeof body.source === 'string' ? body.source : 'admin'
  if (!VALID_WAITLIST_SOURCES.includes(rawSource as WaitlistSource)) {
    ctx.status = 400
    ctx.body = { error: 'Invalid source' }
    return
  }

  const source = rawSource as WaitlistSource
  const entry = await addWaitlistEntry(email, source)
  ctx.status = 201
  ctx.body = entry
})

export { adminRouter }

