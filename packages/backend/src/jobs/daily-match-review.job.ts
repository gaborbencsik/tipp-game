import { and, eq, gte, isNull, lt, asc, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { matches, users, predictions, pushSubscriptions } from '../db/schema/index.js'
import { sendToUser } from '../services/webpush.service.js'
import { createLogger } from '../services/logger.service.js'
import { getPushSettings } from '../services/push-settings.service.js'

const logger = createLogger('daily-match-review')

const PUSH_TYPE = 'daily_match_review' as const
const TIMEZONE = 'Europe/Budapest'
// Tournament window: 17:00 today → 07:00 tomorrow (Europe/Budapest).
// Covers prime-time European matches and the late-night / early-morning American kickoffs.
const WINDOW_START_HOUR_BUDAPEST = 17
const WINDOW_END_HOUR_BUDAPEST = 7

export interface DailyMatchReviewJobResult {
  date: string
  firstMatchId: string | null
  targetCount: number
  sent: number
  failed: number
  durationMs: number
}

interface DayBoundsUTC {
  startUtc: Date
  endUtc: Date
}

function budapestDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (t: string): string => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function todayBoundsUtc(now: Date): DayBoundsUTC {
  const dateKey = budapestDateKey(now)
  // Compute the Budapest UTC offset (in hours). Use a noon-UTC anchor: hourAtTz - 12 = offset
  // (Budapest CEST in summer: noon UTC → 14:00 local → offset +2.)
  const noonAtUtc = new Date(`${dateKey}T12:00:00Z`)
  const hourAtTz = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(noonAtUtc),
  )
  const offsetHours = hourAtTz - 12
  // Window: 17:00 Budapest dateKey → 07:00 Budapest dateKey+1 (14h span).
  // 17:00 Budapest = (17 - offsetHours):00 UTC on dateKey.
  const startUtc = new Date(`${dateKey}T00:00:00Z`)
  startUtc.setUTCHours(WINDOW_START_HOUR_BUDAPEST - offsetHours)
  const endUtc = new Date(startUtc.getTime() + (24 - WINDOW_START_HOUR_BUDAPEST + WINDOW_END_HOUR_BUDAPEST) * 60 * 60 * 1000)
  return { startUtc, endUtc }
}

function formatBudapestTime(date: Date): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

interface TodayMatch { matchId: string; scheduledAt: Date }
interface TargetUser { id: string; missingCount: number }

async function findTodaysMatches(now: Date): Promise<TodayMatch[]> {
  const { startUtc, endUtc } = todayBoundsUtc(now)
  const rows = await db
    .select({ matchId: matches.id, scheduledAt: matches.scheduledAt })
    .from(matches)
    .where(and(
      isNull(matches.deletedAt),
      eq(matches.status, 'scheduled'),
      gte(matches.scheduledAt, startUtc),
      lt(matches.scheduledAt, endUtc),
    ))
    .orderBy(asc(matches.scheduledAt))
  return rows
}

async function findUsersWithMissingTodayTips(now: Date): Promise<TargetUser[]> {
  const { startUtc, endUtc } = todayBoundsUtc(now)
  const rows = await db
    .select({
      id: users.id,
      missingCount: sql<number>`(
        SELECT count(*) FROM matches m
        WHERE m.deleted_at IS NULL
          AND m.status = 'scheduled'
          AND m.scheduled_at >= ${startUtc}
          AND m.scheduled_at < ${endUtc}
          AND NOT EXISTS (
            SELECT 1 FROM predictions p
            WHERE p.match_id = m.id AND p.user_id = ${users.id}
          )
      )::int`,
    })
    .from(users)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
    .where(and(
      isNull(users.deletedAt),
      eq(users.pushEnabled, true),
      isNull(pushSubscriptions.deletedAt),
      sql`EXISTS (
        SELECT 1 FROM matches m
        WHERE m.deleted_at IS NULL
          AND m.status = 'scheduled'
          AND m.scheduled_at >= ${startUtc}
          AND m.scheduled_at < ${endUtc}
          AND NOT EXISTS (
            SELECT 1 FROM predictions p
            WHERE p.match_id = m.id AND p.user_id = ${users.id}
          )
      )`,
    ))
  // Dedup users (multiple subscriptions per user possible)
  const seen = new Map<string, number>()
  for (const r of rows) {
    if (!seen.has(r.id)) seen.set(r.id, Number(r.missingCount))
  }
  return [...seen.entries()].map(([id, missingCount]) => ({ id, missingCount }))
}

export async function runDailyMatchReviewJob(now: Date = new Date()): Promise<DailyMatchReviewJobResult> {
  const startedAt = Date.now()
  const dateKey = budapestDateKey(now)

  const settings = await getPushSettings()
  if (!settings.dailyReviewEnabled) {
    logger.info('daily review skipped: disabled', { date: dateKey })
    return {
      date: dateKey,
      firstMatchId: null,
      targetCount: 0,
      sent: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    }
  }

  const todaysMatches = await findTodaysMatches(now)
  if (todaysMatches.length === 0) {
    logger.info('daily review skipped: no matches today', { date: dateKey })
    return {
      date: dateKey,
      firstMatchId: null,
      targetCount: 0,
      sent: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    }
  }

  const firstMatch = todaysMatches[0]
  const firstMatchTime = formatBudapestTime(firstMatch.scheduledAt)

  const targets = await findUsersWithMissingTodayTips(now)
  let sent = 0
  let failed = 0

  for (const target of targets) {
    try {
      await sendToUser(target.id, {
        title: `⏰ Még ${target.missingCount} tipp hiányzik`,
        body: `Az első meccs ${firstMatchTime}-kor kezdődik. Pótold most!`,
        url: '/app/matches?date=today',
        tag: `daily-review-${dateKey}`,
      }, {
        type: PUSH_TYPE,
        scopeKey: dateKey,
      })
      sent++
    } catch (err) {
      failed++
      logger.error('daily review send failed', {
        userId: target.id,
        date: dateKey,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const durationMs = Date.now() - startedAt
  logger.info('daily review job finished', {
    date: dateKey,
    firstMatchId: firstMatch.matchId,
    targetCount: targets.length,
    sent,
    failed,
    durationMs,
  })

  return {
    date: dateKey,
    firstMatchId: firstMatch.matchId,
    targetCount: targets.length,
    sent,
    failed,
    durationMs,
  }
}
