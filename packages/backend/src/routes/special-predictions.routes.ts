import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'
import { listActiveTypes, createType, updateType, deactivateType } from '../services/special-prediction-types.service.js'
import { getMyPredictions, upsertPrediction } from '../services/special-predictions.service.js'
import type { SpecialTypeInput } from '../types/index.js'

const router = new Router()

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

export { router as specialPredictionsRouter }
