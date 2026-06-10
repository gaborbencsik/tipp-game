import Router from '@koa/router'
import type { Context } from 'koa'
import { resolveTokenToUser } from '../middleware/auth.middleware.js'
import { upsertUser } from '../services/user.service.js'
import {
  eventBus,
  type MatchUpdateEvent,
  type VirtualPointsUpdateEvent,
} from '../services/event-bus.service.js'

const router = new Router()

const SSE_HEARTBEAT_INTERVAL_MS = 30_000
const SSE_RETRY_HINT_MS = 5_000

let activeConnections = 0

export function getActiveSseConnectionCount(): number {
  return activeConnections
}

export function formatSsePayload(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function writeSseEvent(stream: NodeJS.WritableStream, event: string, data: unknown): void {
  stream.write(formatSsePayload(event, data))
}

export function writeSseHeartbeat(stream: NodeJS.WritableStream): void {
  stream.write(': ping\n\n')
}

router.get('/api/events', async (ctx: Context) => {
  // EventSource cannot send Authorization headers — the JWT travels as a
  // query param. Fall back to the standard header for non-browser clients
  // (curl tests, polyfilled clients) so both work.
  const queryToken = typeof ctx.query['token'] === 'string' ? ctx.query['token'] : undefined
  const headerToken = ctx.headers['authorization']?.startsWith('Bearer ')
    ? ctx.headers['authorization'].slice(7)
    : undefined
  const user = await resolveTokenToUser(queryToken ?? headerToken)
  if (!user) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const dbUser = await upsertUser(user)
  const internalUserId = dbUser.id

  ctx.set('Content-Type', 'text/event-stream')
  ctx.set('Cache-Control', 'no-cache, no-transform')
  ctx.set('Connection', 'keep-alive')
  ctx.set('X-Accel-Buffering', 'no')
  ctx.status = 200
  ctx.respond = false

  const res = ctx.res
  res.write(`retry: ${SSE_RETRY_HINT_MS}\n\n`)
  writeSseEvent(res, 'connected', { userId: internalUserId, at: new Date().toISOString() })

  activeConnections += 1

  const onMatchUpdate = (payload: MatchUpdateEvent): void => {
    writeSseEvent(res, 'match.update', payload)
  }

  const onVirtualPointsUpdate = (payload: VirtualPointsUpdateEvent): void => {
    // Per-user filter: only forward events that belong to this connected user.
    if (payload.userId !== internalUserId) return
    writeSseEvent(res, 'virtualPoints.update', payload)
  }

  eventBus.on('match.update', onMatchUpdate)
  eventBus.on('virtualPoints.update', onVirtualPointsUpdate)

  const heartbeat = setInterval(() => {
    writeSseHeartbeat(res)
  }, SSE_HEARTBEAT_INTERVAL_MS)

  const cleanup = (): void => {
    clearInterval(heartbeat)
    eventBus.off('match.update', onMatchUpdate)
    eventBus.off('virtualPoints.update', onVirtualPointsUpdate)
    activeConnections = Math.max(0, activeConnections - 1)
  }

  ctx.req.on('close', cleanup)
  ctx.req.on('aborted', cleanup)
  res.on('close', cleanup)
})

export { router as eventsRouter }
