import { eq, and, min, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { userLeagueFavorites, matches, teams } from '../db/schema/index.js'
import type { UserLeagueFavorite } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export async function getFavoritesForUser(userId: string): Promise<UserLeagueFavorite[]> {
  const rows = await db
    .select()
    .from(userLeagueFavorites)
    .where(eq(userLeagueFavorites.userId, userId))

  const leagueIds = rows.map(r => r.leagueId)
  const lockMap = await getLeagueLockMap(leagueIds)

  return rows.map(row => toFavorite(row, lockMap.get(row.leagueId) ?? false))
}

export async function setFavorite(userId: string, leagueId: string, teamId: string): Promise<UserLeagueFavorite> {
  const locked = await isLeagueLocked(leagueId)
  if (locked) {
    throw new AppError(409, 'League has already started, cannot change favorite')
  }

  const rows = await db
    .insert(userLeagueFavorites)
    .values({ userId, leagueId, teamId })
    .onConflictDoUpdate({
      target: [userLeagueFavorites.userId, userLeagueFavorites.leagueId],
      set: { teamId, setAt: new Date() },
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to set favorite')
  return toFavorite(row, false)
}

export async function getTeamsForLeague(leagueId: string): Promise<Array<{ id: string; name: string; shortCode: string; flagUrl: string | null }>> {
  const rows = await db
    .selectDistinctOn([teams.id], {
      id: teams.id,
      name: teams.name,
      shortCode: teams.shortCode,
      flagUrl: teams.flagUrl,
    })
    .from(matches)
    .innerJoin(teams, sql`${teams.id} = ${matches.homeTeamId} OR ${teams.id} = ${matches.awayTeamId}`)
    .where(eq(matches.leagueId, leagueId))
    .orderBy(teams.id, teams.name)

  return rows
}

async function isLeagueLocked(leagueId: string): Promise<boolean> {
  const result = await db
    .select({ earliest: min(matches.scheduledAt) })
    .from(matches)
    .where(eq(matches.leagueId, leagueId))

  const earliest = result[0]?.earliest
  if (!earliest) return false
  return earliest <= new Date()
}

async function getLeagueLockMap(leagueIds: string[]): Promise<Map<string, boolean>> {
  if (leagueIds.length === 0) return new Map()

  const rows = await db
    .select({
      leagueId: matches.leagueId,
      earliest: min(matches.scheduledAt),
    })
    .from(matches)
    .where(sql`${matches.leagueId} IN ${leagueIds}`)
    .groupBy(matches.leagueId)

  const now = new Date()
  const map = new Map<string, boolean>()
  for (const row of rows) {
    if (row.leagueId) {
      map.set(row.leagueId, row.earliest ? row.earliest <= now : false)
    }
  }
  return map
}

function toFavorite(
  row: typeof userLeagueFavorites.$inferSelect,
  isLocked: boolean,
): UserLeagueFavorite {
  return {
    id: row.id,
    userId: row.userId,
    leagueId: row.leagueId,
    teamId: row.teamId,
    setAt: row.setAt.toISOString(),
    isLocked,
  }
}
