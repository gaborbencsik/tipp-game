import Router from '@koa/router'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'
import {
  subscribe,
  unsubscribe,
  markClicked,
  setPushEnabled,
  getPushStatus,
  listDevices,
  removeDevice,
  disableAll,
} from '../services/push.service.js'

const router = new Router()

router.get('/api/push/status', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  ctx.body = await getPushStatus(dbUser.id)
})

router.post('/api/push/subscribe', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { endpoint?: unknown; auth?: unknown; p256dh?: unknown; userAgent?: unknown }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const auth = typeof body.auth === 'string' ? body.auth.trim() : ''
  const p256dh = typeof body.p256dh === 'string' ? body.p256dh.trim() : ''
  if (!endpoint || !auth || !p256dh) {
    ctx.status = 400
    ctx.body = { error: 'endpoint, auth and p256dh are required' }
    return
  }
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null
  await subscribe({ userId: dbUser.id, endpoint, auth, p256dh, userAgent })
  ctx.status = 201
  ctx.body = { message: 'Subscribed' }
})

router.delete('/api/push/subscribe', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { endpoint?: unknown } | undefined
  const endpoint = body && typeof body.endpoint === 'string' && body.endpoint.trim().length > 0
    ? body.endpoint.trim()
    : undefined
  await unsubscribe(dbUser.id, endpoint)
  ctx.status = 204
})

router.put('/api/users/me/push-enabled', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const body = ctx.request.body as { enabled?: unknown }
  if (typeof body.enabled !== 'boolean') {
    ctx.status = 400
    ctx.body = { error: 'enabled (boolean) is required' }
    return
  }
  await setPushEnabled(dbUser.id, body.enabled)
  ctx.body = { pushEnabled: body.enabled }
})

router.post('/api/push/clicked', async (ctx) => {
  const body = ctx.request.body as { logId?: unknown }
  const logId = typeof body.logId === 'string' ? body.logId.trim() : ''
  if (!logId) {
    ctx.status = 400
    ctx.body = { error: 'logId is required' }
    return
  }
  await markClicked(logId)
  ctx.status = 204
})

router.get('/api/push/devices', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const devices = await listDevices(dbUser.id)
  ctx.body = { devices }
})

router.delete('/api/push/devices/:id', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  const deviceId = ctx.params.id
  if (!deviceId || typeof deviceId !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'device id is required' }
    return
  }
  const result = await removeDevice(dbUser.id, deviceId)
  if (!result.removed) {
    ctx.status = 404
    ctx.body = { error: 'device not found' }
    return
  }
  ctx.body = { success: true, remainingDevices: result.remainingDevices, pushEnabled: result.pushEnabled }
})

router.post('/api/push/disable-all', authMiddleware, async (ctx) => {
  const dbUser = await upsertUser(ctx.state.user)
  await disableAll(dbUser.id)
  ctx.body = { success: true }
})

export { router as pushRouter }
