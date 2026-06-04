import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { pushSubscriptions, pushNotificationLog, users } from '../db/schema/index.js'

export interface SubscribeInput {
  userId: string
  endpoint: string
  auth: string
  p256dh: string
  userAgent?: string | null
}

export async function subscribe(input: SubscribeInput): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      auth: input.auth,
      p256dh: input.p256dh,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: {
        auth: input.auth,
        p256dh: input.p256dh,
        userAgent: input.userAgent ?? null,
        deletedAt: null,
      },
    })
}

export async function unsubscribe(userId: string, endpoint?: string): Promise<void> {
  const now = new Date()
  if (endpoint) {
    await db
      .update(pushSubscriptions)
      .set({ deletedAt: now })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
        isNull(pushSubscriptions.deletedAt),
      ))
    return
  }
  await db
    .update(pushSubscriptions)
    .set({ deletedAt: now })
    .where(and(
      eq(pushSubscriptions.userId, userId),
      isNull(pushSubscriptions.deletedAt),
    ))
}

export async function getActiveSubscriptionCount(userId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.userId, userId),
      isNull(pushSubscriptions.deletedAt),
    ))
  return Number(rows[0]?.c ?? 0)
}

export async function markClicked(logId: string): Promise<void> {
  await db
    .update(pushNotificationLog)
    .set({ clickedAt: new Date() })
    .where(and(
      eq(pushNotificationLog.id, logId),
      isNull(pushNotificationLog.clickedAt),
    ))
}

export async function setPushEnabled(userId: string, enabled: boolean): Promise<void> {
  await db
    .update(users)
    .set({ pushEnabled: enabled, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function getPushStatus(userId: string): Promise<{ pushEnabled: boolean; activeSubscriptions: number }> {
  const userRows = await db
    .select({ pushEnabled: users.pushEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const pushEnabled = userRows[0]?.pushEnabled ?? false
  const activeSubscriptions = await getActiveSubscriptionCount(userId)
  return { pushEnabled, activeSubscriptions }
}
