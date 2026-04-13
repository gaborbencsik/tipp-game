import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'
import { getMyGroups, createGroup, joinGroup, getGroupMembers, removeMember, setMemberAdmin } from '../services/groups.service.js'
import { getGroupLeaderboard } from '../services/group-leaderboard.service.js'
import type { GroupInput, JoinGroupInput } from '../types/index.js'

const router = new Router()

router.get('/api/groups/mine', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getMyGroups(dbUser.id)
})

router.post('/api/groups', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { name?: unknown; description?: unknown }
  const name = body.name
  if (typeof name !== 'string' || name.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'name is required' }
    return
  }
  const input: GroupInput = {
    name: name.trim(),
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
  }
  ctx.status = 201
  ctx.body = await createGroup(input, dbUser.id)
})

router.post('/api/groups/join', authMiddleware, async (ctx) => {
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

export { router as groupsRouter }
