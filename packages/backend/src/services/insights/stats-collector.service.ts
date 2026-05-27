import { eq, inArray } from 'drizzle-orm'
import type { FootballApiClient } from '../football-api.service.js'
import { FootballApiError } from '../football-api.service.js'
import type { ApiFootballFixture } from '../../types/index.js'
import { db } from '../../db/client.js'
import { matchInsights, matches, teams } from '../../db/schema/index.js'
import { StatsCollectionError, type RawMatchStats, type RecentMatch, type TeamStats } from './stats.types.js'

export const SEASONS: readonly number[] = [2024, 2025, 2026]
const FINISHED_STATUSES: ReadonlySet<string> = new Set(['FT', 'AET', 'PEN'])
const WINDOW_MONTHS = 24
const FORM_LENGTH = 5

function emptyTeamStats(externalId: number): TeamStats {
  return {
    externalId,
    totalMatches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
    goalsScored: 0,
    goalsScoredPerMatch: 0,
    goalsConceded: 0,
    goalsConcededPerMatch: 0,
    cleanSheets: 0,
    cleanSheetRate: 0,
    formString: '',
    recentMatches: [],
  }
}

function isFinished(fixture: ApiFootballFixture): boolean {
  if (!FINISHED_STATUSES.has(fixture.fixture.status?.short ?? '')) return false
  return fixture.goals.home !== null && fixture.goals.away !== null
}

function withinWindow(fixture: ApiFootballFixture, cutoff: Date): boolean {
  const date = new Date(fixture.fixture.date)
  return date.getTime() >= cutoff.getTime()
}

function dedupeFixtures(fixtures: readonly ApiFootballFixture[]): ApiFootballFixture[] {
  const byId = new Map<number, ApiFootballFixture>()
  for (const f of fixtures) byId.set(f.fixture.id, f)
  return [...byId.values()]
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildRecentMatch(fixture: ApiFootballFixture, externalId: number): RecentMatch {
  const isHome = fixture.teams.home.id === externalId
  const goalsFor = isHome ? fixture.goals.home! : fixture.goals.away!
  const goalsAgainst = isHome ? fixture.goals.away! : fixture.goals.home!
  const opponent = isHome ? fixture.teams.away.name : fixture.teams.home.name
  let result: 'W' | 'D' | 'L'
  if (goalsFor > goalsAgainst) result = 'W'
  else if (goalsFor < goalsAgainst) result = 'L'
  else result = 'D'
  return {
    date: fixture.fixture.date,
    competition: fixture.league.round ?? '',
    opponent,
    goalsFor,
    goalsAgainst,
    result,
  }
}

export async function collectTeamStats(
  client: FootballApiClient,
  externalId: number,
  now: Date = new Date(),
): Promise<TeamStats> {
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - WINDOW_MONTHS)

  const useDateRange = process.env['INSIGHT_RAW_STATS_USE_DATE_RANGE'] === 'true'

  const all: ApiFootballFixture[] = []
  try {
    if (useDateRange) {
      const res = await client.fetchTeamFixturesByDateRange({
        teamId: externalId,
        from: toIsoDate(cutoff),
        to: toIsoDate(now),
      })
      all.push(...res.response)
    } else {
      for (const season of SEASONS) {
        const res = await client.fetchTeamFixtures({ teamId: externalId, season })
        all.push(...res.response)
      }
    }
  } catch (err) {
    if (err instanceof FootballApiError) {
      throw new StatsCollectionError(
        `Failed to fetch fixtures for team ${externalId}: ${err.message}`,
        err,
      )
    }
    throw err
  }

  const filtered = dedupeFixtures(all)
    .filter(isFinished)
    .filter(f => withinWindow(f, cutoff))
    .sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())

  if (filtered.length === 0) return emptyTeamStats(externalId)

  let wins = 0, draws = 0, losses = 0, goalsScored = 0, goalsConceded = 0, cleanSheets = 0
  const recentMatches: RecentMatch[] = []
  for (const f of filtered) {
    const rm = buildRecentMatch(f, externalId)
    recentMatches.push(rm)
    goalsScored += rm.goalsFor
    goalsConceded += rm.goalsAgainst
    if (rm.goalsAgainst === 0) cleanSheets += 1
    if (rm.result === 'W') wins += 1
    else if (rm.result === 'D') draws += 1
    else losses += 1
  }

  const totalMatches = filtered.length
  const formString = recentMatches
    .slice(0, FORM_LENGTH)
    .reverse()
    .map(m => m.result)
    .join('')

  return {
    externalId,
    totalMatches,
    wins,
    draws,
    losses,
    winRate: wins / totalMatches,
    goalsScored,
    goalsScoredPerMatch: goalsScored / totalMatches,
    goalsConceded,
    goalsConcededPerMatch: goalsConceded / totalMatches,
    cleanSheets,
    cleanSheetRate: cleanSheets / totalMatches,
    formString,
    recentMatches,
  }
}

export async function collectMatchStats(
  client: FootballApiClient,
  matchId: string,
  now: Date = new Date(),
): Promise<RawMatchStats> {
  const matchRow = await db
    .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)

  const m = matchRow[0]
  if (!m) {
    throw new StatsCollectionError(`Match not found: ${matchId}`)
  }

  const teamRows = await db
    .select({ id: teams.id, externalId: teams.externalId })
    .from(teams)
    .where(inArray(teams.id, [m.homeTeamId, m.awayTeamId]))

  const teamById = new Map(teamRows.map(t => [t.id, t.externalId]))
  const homeExt = teamById.get(m.homeTeamId) ?? null
  const awayExt = teamById.get(m.awayTeamId) ?? null

  if (homeExt === null) {
    throw new StatsCollectionError(`Home team for match ${matchId} has no externalId`)
  }
  if (awayExt === null) {
    throw new StatsCollectionError(`Away team for match ${matchId} has no externalId`)
  }

  const [homeTeam, awayTeam] = await Promise.all([
    collectTeamStats(client, homeExt, now),
    collectTeamStats(client, awayExt, now),
  ])

  return { homeTeam, awayTeam }
}

export async function saveMatchStats(matchId: string, stats: RawMatchStats): Promise<void> {
  await db
    .insert(matchInsights)
    .values({
      matchId,
      type: 'raw_stats',
      data: stats as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [matchInsights.matchId, matchInsights.type],
      set: {
        data: stats as unknown as Record<string, unknown>,
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
}
