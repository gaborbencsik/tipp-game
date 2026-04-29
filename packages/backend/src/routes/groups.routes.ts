import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { createRateLimit } from '../middleware/rateLimit.middleware.js'
import { upsertUser } from '../services/user.service.js'
import { getMyGroups, createGroup, joinGroup, getGroupMembers, removeMember, setMemberAdmin, regenerateInviteCode, setInviteActive, deleteGroup, updateGroupSettings, setGroupLeague } from '../services/groups.service.js'
import { getGroupLeaderboard } from '../services/group-leaderboard.service.js'
import { getMyGroupPredictions } from '../services/group-my-predictions.service.js'
import { getGroupConfig, setGroupConfig } from '../services/scoring-config.service.js'
import type { GroupInput, JoinGroupInput, ScoringConfigInput } from '../types/index.js'

const router = new Router()

const joinRateLimit = createRateLimit({ windowMs: 60_000, max: 10 })

router.get('/api/groups/mine', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getMyGroups(dbUser.id)
})

router.post('/api/groups', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { name?: unknown; description?: unknown; leagueId?: unknown }
  const name = body.name
  if (typeof name !== 'string' || name.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'name is required' }
    return
  }
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : ''
  const input: GroupInput = {
    name: name.trim(),
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
    leagueId,
  }
  ctx.status = 201
  ctx.body = await createGroup(input, dbUser.id)
})

router.post('/api/groups/join', joinRateLimit, authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { inviteCode?: unknown }
  const inviteCode = body.inviteCode
  if (typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'inviteCode is required' }
    return
  }
  const input: JoinGroupInput = { inviteCode: inviteCode.trim().toUpperCase() }
  ctx.body = await joinGroup(input.inviteCode, dbUser.id)
})

router.get('/api/groups/:groupId/leaderboard', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getGroupLeaderboard(ctx.params.groupId, dbUser.id)
})

router.get('/api/groups/:groupId/my-predictions', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getMyGroupPredictions(ctx.params.groupId, dbUser.id)
})

router.get('/api/groups/:groupId/members', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getGroupMembers(ctx.params.groupId, dbUser.id)
})

router.delete('/api/groups/:groupId/members/:userId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  await removeMember(ctx.params.groupId, ctx.params.userId, dbUser.id)
  ctx.body = { success: true }
})

router.put('/api/groups/:groupId/members/:userId/role', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { isAdmin?: unknown }
  if (typeof body.isAdmin !== 'boolean') {
    ctx.status = 400
    ctx.body = { error: 'isAdmin must be a boolean' }
    return
  }
  ctx.body = await setMemberAdmin(ctx.params.groupId, ctx.params.userId, body.isAdmin, dbUser.id)
})

router.put('/api/groups/:groupId/invite', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await regenerateInviteCode(ctx.params.groupId, dbUser.id)
})

router.patch('/api/groups/:groupId/invite', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { active?: unknown }
  if (typeof body.active !== 'boolean') {
    ctx.status = 400
    ctx.body = { error: 'active must be a boolean' }
    return
  }
  ctx.body = await setInviteActive(ctx.params.groupId, body.active, dbUser.id)
})

router.delete('/api/groups/:groupId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const isGlobalAdmin = ctx.state.user.role === 'admin'
  await deleteGroup(ctx.params.groupId, dbUser.id, isGlobalAdmin)
  ctx.status = 204
  ctx.body = null
})

router.get('/api/groups/:groupId/scoring-config', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  // getGroupMembers throws 403 if not a member
  await getGroupMembers(ctx.params.groupId, dbUser.id)
  ctx.body = await getGroupConfig(ctx.params.groupId)
})

router.put('/api/groups/:groupId/scoring-config', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const members = await getGroupMembers(ctx.params.groupId, dbUser.id)
  const isGroupAdmin = members.some(m => m.userId === dbUser.id && m.isAdmin)
  if (!isGroupAdmin) {
    ctx.status = 403
    ctx.body = { error: 'Not a group admin' }
    return
  }
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
  ctx.body = await setGroupConfig(ctx.params.groupId, body as unknown as ScoringConfigInput)
})

router.patch('/api/groups/:groupId/settings', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as Record<string, unknown>
  const settings: Record<string, boolean> = {}
  if (typeof body.favoriteTeamDoublePoints === 'boolean') {
    settings.favoriteTeamDoublePoints = body.favoriteTeamDoublePoints
  }
  ctx.body = await updateGroupSettings(ctx.params.groupId, dbUser.id, settings)
})

router.put('/api/groups/:groupId/leagues', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { leagueId?: unknown }
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : ''
  ctx.body = await setGroupLeague(ctx.params.groupId, dbUser.id, leagueId)
})

export { router as groupsRouter }
