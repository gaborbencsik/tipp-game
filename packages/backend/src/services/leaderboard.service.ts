import { eq, sum, count, isNull, isNotNull, sql, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions, matches, userLeagueFavorites, teams } from '../db/schema/index.js'

export interface LeaderboardEntry {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly totalPoints: number
  readonly predictionCount: number
  readonly correctCount: number
  readonly specialPredictionPoints: number
  readonly favoriteTeam?: { readonly countryCode: string; readonly name: string } | null
  readonly isPaid?: boolean
  readonly isSupporter: boolean
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      supporterAt: users.supporterAt,
      totalPoints: sql<number>`coalesce(sum(${predictions.pointsGlobal}), 0)`,
      predictionCount: count(predictions.id),
      correctCount: sql<number>`count(case when ${predictions.pointsGlobal} > 0 then 1 end)`,
    })
    .from(users)
    .leftJoin(predictions, eq(predictions.userId, users.id))
    .leftJoin(matches, eq(matches.id, predictions.matchId))
    .where(and(
      isNull(users.deletedAt),
      sql`(${predictions.id} IS NULL OR ${matches.deletedAt} IS NULL)`,
    ))
    .groupBy(users.id, users.displayName, users.avatarUrl, users.supporterAt)
    .orderBy(sql`coalesce(sum(${predictions.pointsGlobal}), 0) desc`)

  // Pick each user's earliest favorite team (stable across requests).
  const userIds = rows.map(r => r.userId)
  const favoritesByUser = new Map<string, { countryCode: string; name: string }>()
  if (userIds.length > 0) {
    const favRows = await db
      .select({
        userId: userLeagueFavorites.userId,
        setAt: userLeagueFavorites.setAt,
        countryCode: teams.countryCode,
        teamName: teams.name,
      })
      .from(userLeagueFavorites)
      .innerJoin(teams, eq(teams.id, userLeagueFavorites.teamId))
      .where(inArray(userLeagueFavorites.userId, userIds))
      .orderBy(userLeagueFavorites.setAt)
    for (const row of favRows) {
      if (row.countryCode && !favoritesByUser.has(row.userId)) {
        favoritesByUser.set(row.userId, { countryCode: row.countryCode, name: row.teamName })
      }
    }
  }

  let rank = 1
  return rows.map((row, i) => {
    if (i > 0 && row.totalPoints < rows[i - 1].totalPoints) {
      rank = i + 1
    }
    return {
      rank,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      totalPoints: Number(row.totalPoints),
      predictionCount: Number(row.predictionCount),
      correctCount: Number(row.correctCount),
      specialPredictionPoints: 0,
      favoriteTeam: favoritesByUser.get(row.userId) ?? null,
      isSupporter: row.supporterAt !== null,
    }
  })
}
