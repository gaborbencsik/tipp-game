import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, auditLogs } from '../db/schema/index.js'
import { sendToUser } from './webpush.service.js'
import type { IPushPayload, ISendOptions } from './webpush.service.js'
import { createLogger } from './logger.service.js'

const logger = createLogger('admin-push')

export interface AdminBroadcastInput {
  title: string
  body: string
  url?: string
  bypassQuietHours?: boolean
  bypassRateLimit?: boolean
}

export interface AdminBroadcastResult {
  totalTargets: number
  delivered: number
  failed: number
  errors: string[]
}

async function listEligibleUserIds(): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.pushEnabled, true),
      isNull(users.deletedAt),
    ))
  return rows.map(r => r.id)
}

export async function getBroadcastTargetCount(): Promise<number> {
  const ids = await listEligibleUserIds()
  return ids.length
}

export async function broadcastToAllUsers(
  actorId: string,
  input: AdminBroadcastInput,
): Promise<AdminBroadcastResult> {
  const startedAt = Date.now()
  const targets = await listEligibleUserIds()
  logger.info('broadcast started', {
    actorId,
    titleLength: input.title.length,
    bodyLength: input.body.length,
    bypassQuietHours: input.bypassQuietHours ?? false,
    bypassRateLimit: input.bypassRateLimit ?? false,
    targetCount: targets.length,
  })

  const payload: IPushPayload = {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: `admin_broadcast_${Date.now()}`,
  }

  const sendOpts: ISendOptions = {
    type: 'admin_broadcast',
    bypassQuietHours: input.bypassQuietHours ?? false,
    bypassRateLimit: input.bypassRateLimit ?? false,
  }

  let delivered = 0
  let failed = 0
  const errors: string[] = []

  for (const userId of targets) {
    try {
      await sendToUser(userId, payload, sendOpts)
      delivered++
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${userId}: ${msg}`)
    }
  }

  await db.insert(auditLogs).values({
    actorId,
    action: 'push_send',
    entityType: 'broadcast',
    entityId: actorId,
    newValue: {
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      bypassQuietHours: input.bypassQuietHours ?? false,
      bypassRateLimit: input.bypassRateLimit ?? false,
      totalTargets: targets.length,
      delivered,
      failed,
    },
  })

  logger.info('broadcast finished', {
    actorId,
    targetCount: targets.length,
    delivered,
    failed,
    durationMs: Date.now() - startedAt,
  })

  return {
    totalTargets: targets.length,
    delivered,
    failed,
    errors,
  }
}
