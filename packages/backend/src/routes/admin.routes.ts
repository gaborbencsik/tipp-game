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
  archiveLeague,
  restoreLeague,
} from '../services/leagues.service.js'
import { runLeagueSync } from '../services/league-sync.service.js'
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
import { evaluateGlobalType, setGlobalCorrectAnswer, evaluateGlobalTypeSlice } from '../services/special-prediction-evaluation.service.js'
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
  setSupporterStatus,
} from '../services/admin-users.service.js'
import { upsertUser } from '../services/user.service.js'
import { setMemberPaidStatus } from '../services/groups.service.js'
import { getGlobalConfigWithImpact, updateGlobalConfig, overrideGlobalConfig } from '../services/scoring-config.service.js'
import { startRecalculation } from '../services/recalculate.service.js'
import { getRecalcStatus } from '../services/sync-state.service.js'
import { getWaitlistEntries, deleteWaitlistEntry, addWaitlistEntry, isValidEmail } from '../services/waitlist.service.js'
import { getAdminStats, getAdminStatsMatches } from '../services/admin-stats.service.js'
import { getBroadcastTargetCount, broadcastToAllUsers, listEligibleUsersBySegment } from '../services/admin-push.service.js'
import type { BroadcastSegment } from '../services/admin-push.service.js'
import { getPushSettings, setKickoffReminderEnabled, setDailyReviewEnabled } from '../services/push-settings.service.js'
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
  const includeArchived = ctx.query['includeArchived'] === 'true'
  ctx.body = await getLeagues({ includeArchived })
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

adminRouter.post('/leagues/:id/archive', async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await archiveLeague(ctx.params['id'] as string, dbUser.id)
})

adminRouter.post('/leagues/:id/restore', async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await restoreLeague(ctx.params['id'] as string, dbUser.id)
})

adminRouter.post('/leagues/:id/sync', async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await runLeagueSync(ctx.params['id'] as string, dbUser.id)
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
  const { homeGoals, awayGoals, extraTimeHomeGoals, extraTimeAwayGoals, outcomeAfterDraw, scorerPlayerIds } = ctx.request.body as {
    homeGoals: number
    awayGoals: number
    extraTimeHomeGoals?: number | null
    extraTimeAwayGoals?: number | null
    outcomeAfterDraw?: MatchOutcome | null
    scorerPlayerIds?: readonly string[]
  }
  if (
    scorerPlayerIds !== undefined &&
    (!Array.isArray(scorerPlayerIds) ||
      !scorerPlayerIds.every((id) => typeof id === 'string' && id.length > 0))
  ) {
    ctx.status = 400
    ctx.body = { error: 'scorerPlayerIds must be a string[] of UUIDs' }
    return
  }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await setResult(
    ctx.params['id'] as string,
    homeGoals,
    awayGoals,
    dbUser.id,
    outcomeAfterDraw,
    scorerPlayerIds,
    extraTimeHomeGoals ?? null,
    extraTimeAwayGoals ?? null,
  )
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

adminRouter.put('/users/:userId/supporter', async (ctx) => {
  const body = ctx.request.body as { supporter?: unknown }
  if (typeof body.supporter !== 'boolean') {
    ctx.status = 400
    ctx.body = { error: 'supporter must be a boolean' }
    return
  }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await setSupporterStatus(
    ctx.params['userId'] as string,
    body.supporter,
    dbUser.id,
  )
})

// ─── Scoring config ───────────────────────────────────────────────────────────

adminRouter.get('/scoring-config', async (ctx) => {
  ctx.body = await getGlobalConfigWithImpact()
})

adminRouter.put('/scoring-config', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const fields: Array<keyof ScoringConfigInput> = [
    'correctOutcomePoints', 'exactBonusPoints', 'extraTimeBonusPoints',
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

adminRouter.post('/scoring-config/override', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  const values = body['values'] as Record<string, unknown> | undefined
  const reason = body['reason']
  const comment = body['comment']
  const recalculate = body['recalculate']
  if (!values || typeof values !== 'object') {
    ctx.status = 400
    ctx.body = { error: 'Field \'values\' is required' }
    return
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'Field \'reason\' is required' }
    return
  }
  const fields: Array<keyof ScoringConfigInput> = [
    'correctOutcomePoints', 'exactBonusPoints', 'extraTimeBonusPoints',
  ]
  for (const field of fields) {
    if (typeof values[field] !== 'number') {
      ctx.status = 400
      ctx.body = { error: `values.${field} must be a number` }
      return
    }
  }
  const dbUser = await upsertUser(ctx.state.user)
  const config = await overrideGlobalConfig(values as unknown as ScoringConfigInput)
  console.log(JSON.stringify({
    level: 'info',
    event: 'scoring_config_override',
    scope: 'global',
    configId: config.id,
    adminUserId: dbUser.id,
    reason,
    comment: typeof comment === 'string' && comment.length > 0 ? comment : null,
    recalculate: recalculate === true,
  }))
  if (recalculate === true) {
    await startRecalculation()
  }
  ctx.body = config
})

adminRouter.post('/scoring/recalculate-all', async (ctx) => {
  const acquired = await startRecalculation()
  if (!acquired) {
    ctx.status = 409
    ctx.body = { error: 'Sync or recalculation already in progress' }
    return
  }
  ctx.status = 202
  ctx.body = { status: 'started' }
})

adminRouter.get('/scoring/recalculate-status', async (ctx) => {
  ctx.body = await getRecalcStatus()
})

// ─── Players ─────────────────────────────────────────────────────────────────

adminRouter.get('/players', async (ctx) => {
  const teamId = typeof ctx.query['teamId'] === 'string' ? ctx.query['teamId'] : undefined
  ctx.body = await getPlayers({ teamId })
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

// US-1311: split set-correct-answer (PATCH) and evaluate (POST) for per-slice flow.
adminRouter.patch('/global-special-types/:typeId/correct-answer', async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>
  if (typeof body.correctAnswer !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'correctAnswer is required' }
    return
  }
  const trimmed = body.correctAnswer.trim()
  if (trimmed.length === 0) {
    ctx.status = 400
    ctx.body = { error: 'correctAnswer must not be empty' }
    return
  }
  ctx.body = await setGlobalCorrectAnswer(ctx.params['typeId'] as string, trimmed)
})

adminRouter.post('/global-special-types/:typeId/evaluate', async (ctx) => {
  const body = (ctx.request.body ?? {}) as Record<string, unknown>
  const slice = typeof body.slice === 'string' && body.slice.trim().length > 0
    ? body.slice.trim()
    : null
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await evaluateGlobalTypeSlice(
    ctx.params['typeId'] as string,
    slice,
    dbUser.id,
    ctx.ip,
  )
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

// --- Stats ---

adminRouter.get('/stats', async (ctx) => {
  ctx.body = await getAdminStats()
})

adminRouter.get('/stats/matches', async (ctx) => {
  ctx.body = await getAdminStatsMatches()
})

// --- Push broadcasts ---

const VALID_SEGMENTS: readonly BroadcastSegment[] = ['all', 'missing-tournament-tips', 'missing-today-match-tips'] as const

function parseSegment(raw: unknown): BroadcastSegment | null {
  if (raw === undefined || raw === null || raw === '') return 'all'
  if (typeof raw !== 'string') return null
  return (VALID_SEGMENTS as readonly string[]).includes(raw) ? raw as BroadcastSegment : null
}

adminRouter.get('/push/targets', async (ctx) => {
  const segment = parseSegment(ctx.query.segment)
  if (segment === null) {
    ctx.status = 400
    ctx.body = { error: 'invalid segment' }
    return
  }
  const count = await getBroadcastTargetCount(segment)
  ctx.body = { count, segment }
})

adminRouter.get('/push/targets/details', async (ctx) => {
  const segment = parseSegment(ctx.query.segment)
  if (segment === null) {
    ctx.status = 400
    ctx.body = { error: 'invalid segment' }
    return
  }
  const users = await listEligibleUsersBySegment(segment)
  ctx.body = { segment, users }
})

adminRouter.post('/push/send', async (ctx) => {
  const body = ctx.request.body as { title?: unknown; body?: unknown; url?: unknown; bypassQuietHours?: unknown; bypassRateLimit?: unknown; segment?: unknown }
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!title || !text) {
    ctx.status = 400
    ctx.body = { error: 'title and body are required' }
    return
  }
  if (title.length > 100 || text.length > 300) {
    ctx.status = 400
    ctx.body = { error: 'title max 100 chars, body max 300 chars' }
    return
  }
  const segment = parseSegment(body.segment)
  if (segment === null) {
    ctx.status = 400
    ctx.body = { error: 'invalid segment' }
    return
  }
  const url = typeof body.url === 'string' && body.url.trim().length > 0 ? body.url.trim() : undefined
  const bypassQuietHours = typeof body.bypassQuietHours === 'boolean' ? body.bypassQuietHours : false
  const bypassRateLimit = typeof body.bypassRateLimit === 'boolean' ? body.bypassRateLimit : false

  const dbUser = await upsertUser(ctx.state.user)
  const result = await broadcastToAllUsers(dbUser.id, {
    title,
    body: text,
    url,
    bypassQuietHours,
    bypassRateLimit,
  }, segment)
  ctx.body = result
})

adminRouter.get('/push/settings', async (ctx) => {
  ctx.body = await getPushSettings()
})

adminRouter.put('/push/settings', async (ctx) => {
  const body = ctx.request.body as { kickoffReminderEnabled?: unknown; dailyReviewEnabled?: unknown }
  if (typeof body.kickoffReminderEnabled === 'boolean') {
    await setKickoffReminderEnabled(body.kickoffReminderEnabled)
  }
  if (typeof body.dailyReviewEnabled === 'boolean') {
    await setDailyReviewEnabled(body.dailyReviewEnabled)
  }
  ctx.body = await getPushSettings()
})

// ─── ADMIN-001: group member paid status ─────────────────────────────────────

adminRouter.put('/groups/:groupId/members/:userId/paid', async (ctx) => {
  const body = ctx.request.body as { paid?: unknown }
  if (typeof body.paid !== 'boolean') {
    ctx.status = 400
    ctx.body = { error: 'paid must be a boolean' }
    return
  }
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await setMemberPaidStatus(
    ctx.params['groupId'] as string,
    ctx.params['userId'] as string,
    body.paid,
    dbUser.id,
  )
})

export { adminRouter }

