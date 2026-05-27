import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { matchInsights, matches, teams } from '../../db/schema/index.js'
import type { FootballApiClient } from '../football-api.service.js'
import { collectTeamStats, saveMatchStats, SEASONS } from './stats-collector.service.js'
import type { RawMatchStats, TeamStats } from './stats.types.js'

export interface RawStatsRunOptions {
  readonly skipFresh: boolean
  readonly freshThresholdHours?: number
}

export interface RawStatsRunError {
  readonly matchId: string
  readonly error: string
}

export interface RawStatsRunResult {
  readonly processed: number
  readonly skipped: number
  readonly errors: ReadonlyArray<RawStatsRunError>
  readonly apiCalls: number
  readonly durationMs: number
}

const DEFAULT_FRESH_THRESHOLD_HOURS = 24

interface MatchRow {
  readonly id: string
  readonly homeTeamId: string
  readonly awayTeamId: string
}

interface ResolvedMatch {
  readonly matchId: string
  readonly homeExternalId: number | null
  readonly awayExternalId: number | null
}

export async function runRawStatsCollection(
  client: FootballApiClient,
  options: RawStatsRunOptions,
  now: Date = new Date(),
): Promise<RawStatsRunResult> {
  const start = Date.now()
  const errors: RawStatsRunError[] = []

  const scheduled: MatchRow[] = await db
    .select({ id: matches.id, homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
    .from(matches)
    .where(and(eq(matches.status, 'scheduled'), isNull(matches.deletedAt)))

  if (scheduled.length === 0) {
    return { processed: 0, skipped: 0, errors: [], apiCalls: 0, durationMs: Date.now() - start }
  }

  const freshMatchIds = options.skipFresh
    ? await loadFreshRawStatsMatchIds(
        scheduled.map((m) => m.id),
        options.freshThresholdHours ?? DEFAULT_FRESH_THRESHOLD_HOURS,
      )
    : new Set<string>()

  const toProcess = scheduled.filter((m) => !freshMatchIds.has(m.id))
  const skipped = scheduled.length - toProcess.length

  if (toProcess.length === 0) {
    return { processed: 0, skipped, errors: [], apiCalls: 0, durationMs: Date.now() - start }
  }

  const resolved = await resolveExternalIds(toProcess)
  const uniqueExternalIds = new Set<number>()
  for (const r of resolved) {
    if (r.homeExternalId !== null) uniqueExternalIds.add(r.homeExternalId)
    if (r.awayExternalId !== null) uniqueExternalIds.add(r.awayExternalId)
  }

  const teamCache = new Map<number, TeamStats | Error>()
  for (const externalId of uniqueExternalIds) {
    try {
      const stats = await collectTeamStats(client, externalId, now)
      teamCache.set(externalId, stats)
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      teamCache.set(externalId, e)
    }
  }

  const useDateRange = process.env['INSIGHT_RAW_STATS_USE_DATE_RANGE'] === 'true'
  const apiCalls = uniqueExternalIds.size * (useDateRange ? 1 : SEASONS.length)

  let processed = 0
  for (const match of resolved) {
    if (match.homeExternalId === null) {
      errors.push({ matchId: match.matchId, error: 'Home team has no externalId' })
      continue
    }
    if (match.awayExternalId === null) {
      errors.push({ matchId: match.matchId, error: 'Away team has no externalId' })
      continue
    }
    const home = teamCache.get(match.homeExternalId)
    const away = teamCache.get(match.awayExternalId)
    if (home instanceof Error) {
      errors.push({ matchId: match.matchId, error: `Home stats fetch failed: ${home.message}` })
      continue
    }
    if (away instanceof Error) {
      errors.push({ matchId: match.matchId, error: `Away stats fetch failed: ${away.message}` })
      continue
    }
    if (!home || !away) {
      errors.push({ matchId: match.matchId, error: 'Team stats missing from cache' })
      continue
    }
    const stats: RawMatchStats = { homeTeam: home, awayTeam: away }
    try {
      await saveMatchStats(match.matchId, stats)
      processed += 1
    } catch (err) {
      errors.push({
        matchId: match.matchId,
        error: `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  return { processed, skipped, errors, apiCalls, durationMs: Date.now() - start }
}

async function loadFreshRawStatsMatchIds(
  matchIds: readonly string[],
  thresholdHours: number,
): Promise<Set<string>> {
  if (matchIds.length === 0) return new Set()
  const cutoff = sql`now() - ${sql.raw(`interval '${thresholdHours} hours'`)}`
  const rows = await db
    .select({ matchId: matchInsights.matchId })
    .from(matchInsights)
    .where(
      and(
        inArray(matchInsights.matchId, matchIds as string[]),
        eq(matchInsights.type, 'raw_stats'),
        gt(matchInsights.generatedAt, cutoff),
      ),
    )
  return new Set(rows.map((r) => r.matchId))
}

async function resolveExternalIds(matchRows: readonly MatchRow[]): Promise<ResolvedMatch[]> {
  const teamIds = new Set<string>()
  for (const m of matchRows) {
    teamIds.add(m.homeTeamId)
    teamIds.add(m.awayTeamId)
  }
  const teamRows = await db
    .select({ id: teams.id, externalId: teams.externalId })
    .from(teams)
    .where(inArray(teams.id, [...teamIds]))
  const externalById = new Map(teamRows.map((t) => [t.id, t.externalId]))
  return matchRows.map((m) => ({
    matchId: m.id,
    homeExternalId: externalById.get(m.homeTeamId) ?? null,
    awayExternalId: externalById.get(m.awayTeamId) ?? null,
  }))
}
