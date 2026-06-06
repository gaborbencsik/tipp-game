import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db/client.js'
import { matches, teams, users, predictions, pushSubscriptions } from '../db/schema/index.js'
import { sendToUser } from '../services/webpush.service.js'
import { createLogger } from '../services/logger.service.js'
import { getPushSettings } from '../services/push-settings.service.js'

const logger = createLogger('match-kickoff-reminder')

const REMINDER_WINDOW_MINUTES = 45
const PUSH_TYPE = 'match_kickoff_reminder' as const

interface UpcomingMatchRow {
  matchId: string
  scheduledAt: Date
  homeName: string
  awayName: string
}

export interface MatchKickoffReminderJobResult {
  matchesProcessed: number
  sent: number
  failed: number
  durationMs: number
}

async function findUpcomingMatches(now: Date): Promise<UpcomingMatchRow[]> {
  const horizon = new Date(now.getTime() + REMINDER_WINDOW_MINUTES * 60 * 1000)
  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')
  const rows = await db
    .select({
      matchId: matches.id,
      scheduledAt: matches.scheduledAt,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
    })
    .from(matches)
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .where(and(
      isNull(matches.deletedAt),
      eq(matches.status, 'scheduled'),
      gt(matches.scheduledAt, now),
      lte(matches.scheduledAt, horizon),
    ))
  return rows
}

async function findMissingPredictionUserIds(matchId: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, users.id))
    .where(and(
      isNull(users.deletedAt),
      eq(users.pushEnabled, true),
      isNull(pushSubscriptions.deletedAt),
      sql`NOT EXISTS (SELECT 1 FROM predictions p WHERE p.match_id = ${matchId} AND p.user_id = ${users.id})`,
    ))
  // Dedup user ids across multiple subscriptions
  const seen = new Set<string>()
  for (const r of rows) seen.add(r.id)
  return [...seen]
}

function formatBudapestTime(date: Date): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export async function runMatchKickoffReminderJob(now: Date = new Date()): Promise<MatchKickoffReminderJobResult> {
  const startedAt = Date.now()
  let sent = 0
  let failed = 0

  const settings = await getPushSettings()
  if (!settings.kickoffReminderEnabled) {
    logger.info('kickoff reminder skipped: disabled')
    return { matchesProcessed: 0, sent: 0, failed: 0, durationMs: Date.now() - startedAt }
  }

  const upcoming = await findUpcomingMatches(now)

  for (const match of upcoming) {
    try {
      const userIds = await findMissingPredictionUserIds(match.matchId)
      const kickoffStr = formatBudapestTime(match.scheduledAt)
      for (const userId of userIds) {
        try {
          await sendToUser(userId, {
            title: `${match.homeName} – ${match.awayName} hamarosan`,
            body: `Még nem tippeltél! Kezdés: ${kickoffStr}`,
            url: `/app/matches?focus=${match.matchId}`,
            tag: `match-kickoff-${match.matchId}`,
          }, {
            type: PUSH_TYPE,
            scopeKey: match.matchId,
          })
          sent++
        } catch (err) {
          failed++
          logger.error('reminder send failed', {
            matchId: match.matchId,
            userId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } catch (err) {
      logger.error('match processing failed', {
        matchId: match.matchId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const durationMs = Date.now() - startedAt
  logger.info('kickoff reminder job finished', {
    matchesProcessed: upcoming.length,
    sent,
    failed,
    durationMs,
  })

  return { matchesProcessed: upcoming.length, sent, failed, durationMs }
}
