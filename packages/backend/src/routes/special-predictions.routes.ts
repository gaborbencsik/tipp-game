import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'
import { listActiveTypes, createType, updateType, deactivateType } from '../services/special-prediction-types.service.js'
import { getMyPredictions, upsertPrediction } from '../services/special-predictions.service.js'
import { setCorrectAnswer } from '../services/special-prediction-evaluation.service.js'
import { listAvailableGlobalTypes, subscribeGroup, unsubscribeGroup } from '../services/global-type-subscriptions.service.js'
import { getTeams } from '../services/teams.service.js'
import { getPlayers } from '../services/players.service.js'
import { STAT_PREDICTION_TEMPLATES } from '../constants/stat-prediction-templates.js'
import type { SpecialTypeInput } from '../types/index.js'

const router = new Router()

// ─── Public teams list (for team_select input type) ─────────────────────────

router.get('/api/teams', authMiddleware, async (ctx) => {
  ctx.body = await getTeams()
})

// ─── Public players list (for player_select input type) ────────────────────

router.get('/api/players', authMiddleware, async (ctx) => {
  ctx.body = await getPlayers()
})

// ─── Stat prediction templates ──────────────────────────────────────────────

router.get('/api/stat-prediction-templates', authMiddleware, async (ctx) => {
  ctx.body = STAT_PREDICTION_TEMPLATES
})

router.get('/api/groups/:groupId/special-types', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await listActiveTypes(ctx.params.groupId, dbUser.id)
})

router.post('/api/groups/:groupId/special-types', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as Record<string, unknown>

  const input: SpecialTypeInput = {
    name: body.name as string,
    description: typeof body.description === 'string' ? body.description : undefined,
    inputType: body.inputType as 'text' | 'dropdown',
    options: Array.isArray(body.options) ? body.options as string[] : undefined,
    deadline: body.deadline as string,
    points: body.points as number,
  }

  ctx.status = 201
  ctx.body = await createType(ctx.params.groupId, dbUser.id, input)
})

router.put('/api/groups/:groupId/special-types/:typeId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as Record<string, unknown>

  const input: Partial<SpecialTypeInput> = {}
  if (body.name !== undefined) (input as Record<string, unknown>).name = body.name
  if (body.description !== undefined) (input as Record<string, unknown>).description = body.description
  if (body.inputType !== undefined) (input as Record<string, unknown>).inputType = body.inputType
  if (body.options !== undefined) (input as Record<string, unknown>).options = body.options
  if (body.deadline !== undefined) (input as Record<string, unknown>).deadline = body.deadline
  if (body.points !== undefined) (input as Record<string, unknown>).points = body.points

  ctx.body = await updateType(ctx.params.groupId, ctx.params.typeId, dbUser.id, input)
})

router.delete('/api/groups/:groupId/special-types/:typeId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  await deactivateType(ctx.params.groupId, ctx.params.typeId, dbUser.id)
  ctx.status = 204
  ctx.body = null
})

router.put('/api/groups/:groupId/special-types/:typeId/answer', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as Record<string, unknown>

  if (typeof body.correctAnswer !== 'string' || body.correctAnswer.trim().length === 0) {
    ctx.status = 400
    ctx.body = { error: 'correctAnswer is required' }
    return
  }

  ctx.body = await setCorrectAnswer(ctx.params.groupId, ctx.params.typeId, dbUser.id, body.correctAnswer.trim())
})

// ─── Special Predictions (member submit/fetch) ───────────────────────────────

router.get('/api/groups/:groupId/special-predictions', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getMyPredictions(ctx.params.groupId, dbUser.id)
})

router.post('/api/groups/:groupId/special-predictions', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as Record<string, unknown>

  if (typeof body.typeId !== 'string' || typeof body.answer !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'typeId and answer are required' }
    return
  }

  ctx.body = await upsertPrediction(ctx.params.groupId, dbUser.id, {
    typeId: body.typeId,
    answer: body.answer,
  })
})

// ─── Global Type Subscriptions ──────────────────────────────────────────────

router.get('/api/groups/:groupId/global-type-subscriptions', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await listAvailableGlobalTypes(ctx.params.groupId, dbUser.id)
})

router.post('/api/groups/:groupId/global-type-subscriptions/:typeId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  await subscribeGroup(ctx.params.groupId, ctx.params.typeId, dbUser.id)
  ctx.status = 201
  ctx.body = { ok: true }
})

router.delete('/api/groups/:groupId/global-type-subscriptions/:typeId', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  await unsubscribeGroup(ctx.params.groupId, ctx.params.typeId, dbUser.id)
  ctx.status = 204
  ctx.body = null
})

export { router as specialPredictionsRouter }
