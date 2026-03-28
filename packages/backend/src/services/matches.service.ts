import { alias } from 'drizzle-orm/pg-core'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { matches, teams, venues, matchResults } from '../db/schema/index.js'
import type { Match, MatchesFilters } from '../types/index.js'

const homeTeamAlias = alias(teams, 'home_team')
const awayTeamAlias = alias(teams, 'away_team')

export async function getMatches(filters: MatchesFilters = {}): Promise<Match[]> {
  const conditions = [isNull(matches.deletedAt)]
  if (filters.stage) conditions.push(eq(matches.stage, filters.stage))
  if (filters.status) conditions.push(eq(matches.status, filters.status))

  const rows = await db
    .select()
    .from(matches)
    .leftJoin(homeTeamAlias, eq(matches.homeTeamId, homeTeamAlias.id))
    .leftJoin(awayTeamAlias, eq(matches.awayTeamId, awayTeamAlias.id))
    .leftJoin(venues, eq(matches.venueId, venues.id))
    .leftJoin(matchResults, eq(matchResults.matchId, matches.id))
    .where(and(...conditions))
    .orderBy(matches.scheduledAt)

  return rows.map((row): Match => ({
    id: row.matches.id,
    homeTeam: {
      id: row.home_team?.id ?? '',
      name: row.home_team?.name ?? '',
      shortCode: row.home_team?.shortCode ?? '',
      flagUrl: row.home_team?.flagUrl ?? null,
    },
    awayTeam: {
      id: row.away_team?.id ?? '',
      name: row.away_team?.name ?? '',
      shortCode: row.away_team?.shortCode ?? '',
      flagUrl: row.away_team?.flagUrl ?? null,
    },
    venue: row.venues
      ? { name: row.venues.name, city: row.venues.city }
      : null,
    stage: row.matches.stage,
    groupName: row.matches.groupName ?? null,
    matchNumber: row.matches.matchNumber ?? null,
    scheduledAt: row.matches.scheduledAt.toISOString(),
    status: row.matches.status,
    result: row.match_results
      ? { homeGoals: row.match_results.homeGoals, awayGoals: row.match_results.awayGoals }
      : null,
  }))
}
