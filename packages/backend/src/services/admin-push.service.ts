import { and, eq, isNull, sql, asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, auditLogs } from '../db/schema/index.js'
import { sendToUser } from './webpush.service.js'
import type { IPushPayload, ISendOptions } from './webpush.service.js'
import { createLogger } from './logger.service.js'

const logger = createLogger('admin-push')

export type BroadcastSegment =
  | 'all'
  | 'missing-tournament-tips'
  | 'missing-today-match-tips'

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

export interface EligibleUserSummary {
  id: string
  displayName: string | null
  email: string
}

const MAX_DETAILS_ROWS = 500

const MISSING_TOURNAMENT_TIPS_SQL = sql`EXISTS (
  SELECT 1 FROM special_prediction_types t
  WHERE t.is_global = true
    AND t.is_active = true
    AND t.deadline > now()
    AND NOT EXISTS (
      SELECT 1 FROM special_predictions sp
      WHERE sp.type_id = t.id
        AND sp.user_id = ${users.id}
    )
)`

const MISSING_TODAY_MATCH_TIPS_SQL = sql`EXISTS (
  SELECT 1 FROM matches m
  WHERE m.deleted_at IS NULL
    AND m.status = 'scheduled'
    AND date(m.scheduled_at AT TIME ZONE 'Europe/Budapest') = date(now() AT TIME ZONE 'Europe/Budapest')
    AND NOT EXISTS (
      SELECT 1 FROM predictions p
      WHERE p.match_id = m.id
        AND p.user_id = ${users.id}
    )
)`

async function listEligibleUserIdsBySegment(segment: BroadcastSegment): Promise<string[]> {
  const baseConds = [eq(users.pushEnabled, true), isNull(users.deletedAt)]
  if (segment === 'missing-tournament-tips') {
    baseConds.push(MISSING_TOURNAMENT_TIPS_SQL)
  } else if (segment === 'missing-today-match-tips') {
    baseConds.push(MISSING_TODAY_MATCH_TIPS_SQL)
  }
  const rows = await db.select({ id: users.id }).from(users).where(and(...baseConds))
  return rows.map(r => r.id)
}

export async function listEligibleUsersBySegment(segment: BroadcastSegment): Promise<EligibleUserSummary[]> {
  const baseConds = [eq(users.pushEnabled, true), isNull(users.deletedAt)]
  if (segment === 'missing-tournament-tips') {
    baseConds.push(MISSING_TOURNAMENT_TIPS_SQL)
  } else if (segment === 'missing-today-match-tips') {
    baseConds.push(MISSING_TODAY_MATCH_TIPS_SQL)
  }
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
    })
    .from(users)
    .where(and(...baseConds))
    .orderBy(asc(sql`coalesce(${users.displayName}, ${users.email})`))
  return rows.slice(0, MAX_DETAILS_ROWS)
}

export async function getBroadcastTargetCount(segment: BroadcastSegment = 'all'): Promise<number> {
  const ids = await listEligibleUserIdsBySegment(segment)
  return ids.length
}

export async function broadcastToAllUsers(
  actorId: string,
  input: AdminBroadcastInput,
  segment: BroadcastSegment = 'all',
): Promise<AdminBroadcastResult> {
  const startedAt = Date.now()
  const targets = await listEligibleUserIdsBySegment(segment)
  logger.info('broadcast started', {
    actorId,
    segment,
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
      segment,
      bypassQuietHours: input.bypassQuietHours ?? false,
      bypassRateLimit: input.bypassRateLimit ?? false,
      totalTargets: targets.length,
      delivered,
      failed,
    },
  })

  logger.info('broadcast finished', {
    actorId,
    segment,
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
