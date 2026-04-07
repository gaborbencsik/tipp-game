import { alias } from 'drizzle-orm/pg-core'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { matches, teams, venues, matchResults } from '../db/schema/index.js'
import { calculateAndSavePoints } from './scoring.service.js'
import type { Match, MatchesFilters, MatchInput, MatchOutcome, MatchRow, MatchResultRow } from '../types/index.js'

const homeTeamAlias = alias(teams, 'home_team')
const awayTeamAlias = alias(teams, 'away_team')

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

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
      ? {
          homeGoals: row.match_results.homeGoals,
          awayGoals: row.match_results.awayGoals,
          outcomeAfterDraw: (row.match_results.outcomeAfterDraw as MatchOutcome | null) ?? null,
        }
      : null,
  }))
}

export async function createMatch(input: MatchInput): Promise<MatchRow> {
  const rows = await db
    .insert(matches)
    .values({
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      venueId: input.venueId ?? null,
      stage: input.stage,
      groupName: input.groupName ?? null,
      matchNumber: input.matchNumber ?? null,
      scheduledAt: new Date(input.scheduledAt),
      status: input.status ?? 'scheduled',
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create match')
  return row
}

export async function updateMatch(id: string, input: Partial<MatchInput>): Promise<MatchRow> {
  const rows = await db
    .update(matches)
    .set({
      ...(input.homeTeamId !== undefined && { homeTeamId: input.homeTeamId }),
      ...(input.awayTeamId !== undefined && { awayTeamId: input.awayTeamId }),
      ...(input.venueId !== undefined && { venueId: input.venueId }),
      ...(input.stage !== undefined && { stage: input.stage }),
      ...(input.groupName !== undefined && { groupName: input.groupName }),
      ...(input.matchNumber !== undefined && { matchNumber: input.matchNumber }),
      ...(input.scheduledAt !== undefined && { scheduledAt: new Date(input.scheduledAt) }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date(),
    })
    .where(and(eq(matches.id, id), isNull(matches.deletedAt)))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(404, 'Match not found')
  return row
}

export async function deleteMatch(id: string): Promise<void> {
  const rows = await db
    .update(matches)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(matches.id, id), isNull(matches.deletedAt)))
    .returning()

  if (rows.length === 0) throw new AppError(404, 'Match not found')
}

export async function setResult(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  actorId: string,
  outcomeAfterDraw?: MatchOutcome | null,
): Promise<MatchResultRow> {
  const rows = await db
    .insert(matchResults)
    .values({
      matchId,
      homeGoals,
      awayGoals,
      outcomeAfterDraw: outcomeAfterDraw ?? null,
      recordedBy: actorId,
    })
    .onConflictDoUpdate({
      target: matchResults.matchId,
      set: {
        homeGoals,
        awayGoals,
        outcomeAfterDraw: outcomeAfterDraw ?? null,
        recordedBy: actorId,
        updatedAt: new Date(),
      },
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to set result')

  await db
    .update(matches)
    .set({ status: 'finished', updatedAt: new Date() })
    .where(eq(matches.id, matchId))

  await calculateAndSavePoints(matchId, { homeGoals, awayGoals, outcomeAfterDraw: outcomeAfterDraw ?? null })

  return row
}
