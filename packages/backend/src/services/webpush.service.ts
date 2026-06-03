import webpush from 'web-push'
import { eq, and, gte, isNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, pushSubscriptions, pushNotificationLog } from '../db/schema/index.js'

export interface IPushPayload {
  title: string
  body: string
  url?: string
  badge?: string
  tag?: string
  logId?: string
}

export type PushNotificationType =
  | 'match_kickoff_reminder'
  | 'tournament_tip_deadline'
  | 'daily_match_review'
  | 'admin_broadcast'

export interface ISendOptions {
  bypassQuietHours?: boolean
  bypassRateLimit?: boolean
  type?: PushNotificationType
  scopeKey?: string | null
  now?: Date
}

const QUIET_HOURS_START = 22
const QUIET_HOURS_END = 7
const RATE_LIMIT_WINDOW_HOURS = 24
const RATE_LIMIT_MAX = 5

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export function isQuietHourBudapest(now: Date): boolean {
  const hourStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    hour12: false,
  }).format(now)
  const hour = Number.parseInt(hourStr, 10)
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END
}

export class PushPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PushPayloadError'
  }
}

function validatePayload(payload: IPushPayload): void {
  if (!payload.title || payload.title.trim().length === 0) {
    throw new PushPayloadError('payload.title is required')
  }
  if (!payload.body || payload.body.trim().length === 0) {
    throw new PushPayloadError('payload.body is required')
  }
}

async function logEntry(args: {
  userId: string
  type: PushNotificationType
  scopeKey: string | null
  endpoint: string | null
  skippedReason: 'quiet_hours' | 'rate_limit' | 'push_disabled' | 'no_subscription' | null
}): Promise<void> {
  await db.insert(pushNotificationLog).values({
    userId: args.userId,
    type: args.type,
    scopeKey: args.scopeKey,
    endpoint: args.endpoint,
    skippedReason: args.skippedReason,
  }).onConflictDoNothing()
}

async function countRecentSends(userId: string, now: Date): Promise<number> {
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000)
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(pushNotificationLog)
    .where(and(
      eq(pushNotificationLog.userId, userId),
      isNull(pushNotificationLog.skippedReason),
      gte(pushNotificationLog.sentAt, windowStart),
    ))
  return Number(rows[0]?.c ?? 0)
}

export async function sendToUser(
  userId: string,
  payload: IPushPayload,
  options: ISendOptions = {},
): Promise<void> {
  validatePayload(payload)

  const type: PushNotificationType = options.type ?? 'admin_broadcast'
  const scopeKey = options.scopeKey ?? null
  const now = options.now ?? new Date()

  const userRows = await db
    .select({ pushEnabled: users.pushEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userRows[0]) return
  if (!userRows[0].pushEnabled) {
    await logEntry({ userId, type, scopeKey, endpoint: null, skippedReason: 'push_disabled' })
    return
  }

  if (!options.bypassQuietHours && isQuietHourBudapest(now)) {
    await logEntry({ userId, type, scopeKey, endpoint: null, skippedReason: 'quiet_hours' })
    return
  }

  if (!options.bypassRateLimit) {
    const count = await countRecentSends(userId, now)
    if (count >= RATE_LIMIT_MAX) {
      await logEntry({ userId, type, scopeKey, endpoint: null, skippedReason: 'rate_limit' })
      return
    }
  }

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      auth: pushSubscriptions.auth,
      p256dh: pushSubscriptions.p256dh,
    })
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.userId, userId),
      isNull(pushSubscriptions.deletedAt),
    ))

  if (subs.length === 0) {
    await logEntry({ userId, type, scopeKey, endpoint: null, skippedReason: 'no_subscription' })
    return
  }

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        JSON.stringify(payload),
      )
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: now })
        .where(eq(pushSubscriptions.id, sub.id))
      await logEntry({ userId, type, scopeKey, endpoint: sub.endpoint, skippedReason: null })
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await db
          .update(pushSubscriptions)
          .set({ deletedAt: now })
          .where(eq(pushSubscriptions.id, sub.id))
        continue
      }
      throw err
    }
  }
}
