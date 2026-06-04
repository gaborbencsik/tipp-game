import { and, eq, isNull, sql, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { pushSubscriptions, pushNotificationLog, users } from '../db/schema/index.js'
import { parseBrowserName } from './user-agent.service.js'

export interface SubscribeInput {
  userId: string
  endpoint: string
  auth: string
  p256dh: string
  userAgent?: string | null
}

export async function subscribe(input: SubscribeInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
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

    await tx
      .update(users)
      .set({ pushEnabled: true, updatedAt: new Date() })
      .where(and(eq(users.id, input.userId), eq(users.pushEnabled, false)))
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

export interface DeviceDto {
  id: string
  endpoint: string
  browserName: string
  createdAt: Date
  lastUsedAt: Date | null
}

export async function listDevices(userId: string): Promise<DeviceDto[]> {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.userId, userId),
      isNull(pushSubscriptions.deletedAt),
    ))
    .orderBy(desc(pushSubscriptions.createdAt))

  return rows.map(r => ({
    id: r.id,
    endpoint: r.endpoint,
    browserName: parseBrowserName(r.userAgent),
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
  }))
}

export interface RemoveDeviceResult {
  removed: boolean
  remainingDevices: number
  pushEnabled: boolean
}

export async function removeDevice(userId: string, deviceId: string): Promise<RemoveDeviceResult> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: pushSubscriptions.id, deletedAt: pushSubscriptions.deletedAt })
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.id, deviceId),
        eq(pushSubscriptions.userId, userId),
      ))
      .limit(1)

    if (!existing[0]) {
      return { removed: false, remainingDevices: 0, pushEnabled: false }
    }

    if (existing[0].deletedAt === null) {
      await tx
        .update(pushSubscriptions)
        .set({ deletedAt: new Date() })
        .where(eq(pushSubscriptions.id, deviceId))
    }

    const remainingRows = await tx
      .select({ c: sql<number>`count(*)` })
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.deletedAt),
      ))
    const remainingDevices = Number(remainingRows[0]?.c ?? 0)

    if (remainingDevices === 0) {
      await tx
        .update(users)
        .set({ pushEnabled: false, updatedAt: new Date() })
        .where(eq(users.id, userId))
      return { removed: true, remainingDevices: 0, pushEnabled: false }
    }

    const userRows = await tx
      .select({ pushEnabled: users.pushEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return {
      removed: true,
      remainingDevices,
      pushEnabled: userRows[0]?.pushEnabled ?? false,
    }
  })
}

export async function disableAll(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(pushSubscriptions)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.deletedAt),
      ))

    await tx
      .update(users)
      .set({ pushEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
  })
}
