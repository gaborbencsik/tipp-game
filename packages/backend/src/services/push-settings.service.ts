import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { pushSettings } from '../db/schema/index.js'

export interface PushSettings {
  kickoffReminderEnabled: boolean
  dailyReviewEnabled: boolean
}

const DEFAULT_SETTINGS: PushSettings = {
  kickoffReminderEnabled: true,
  dailyReviewEnabled: true,
}

async function ensureRow(): Promise<void> {
  const rows = await db.select({ id: pushSettings.id }).from(pushSettings).limit(1)
  if (rows.length === 0) {
    await db.insert(pushSettings).values({
      kickoffReminderEnabled: true,
      dailyReviewEnabled: true,
    })
  }
}

export async function getPushSettings(): Promise<PushSettings> {
  const rows = await db.select({
    kickoffReminderEnabled: pushSettings.kickoffReminderEnabled,
    dailyReviewEnabled: pushSettings.dailyReviewEnabled,
  }).from(pushSettings).limit(1)
  if (rows.length === 0) return { ...DEFAULT_SETTINGS }
  return {
    kickoffReminderEnabled: rows[0].kickoffReminderEnabled,
    dailyReviewEnabled: rows[0].dailyReviewEnabled,
  }
}

export async function setKickoffReminderEnabled(enabled: boolean): Promise<void> {
  await ensureRow()
  await db.update(pushSettings).set({
    kickoffReminderEnabled: enabled,
    updatedAt: sql`now()`,
  })
}

export async function setDailyReviewEnabled(enabled: boolean): Promise<void> {
  await ensureRow()
  await db.update(pushSettings).set({
    dailyReviewEnabled: enabled,
    updatedAt: sql`now()`,
  })
}
