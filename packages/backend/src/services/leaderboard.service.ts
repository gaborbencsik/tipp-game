import { eq, sum, count, isNull, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions } from '../db/schema/index.js'

export interface LeaderboardEntry {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly totalPoints: number
  readonly predictionCount: number
  readonly correctCount: number
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      totalPoints: sql<number>`coalesce(sum(${predictions.pointsGlobal}), 0)`,
      predictionCount: count(predictions.id),
      correctCount: sql<number>`count(case when ${predictions.pointsGlobal} > 0 then 1 end)`,
    })
    .from(users)
    .leftJoin(predictions, eq(predictions.userId, users.id))
    .where(isNull(users.deletedAt))
    .groupBy(users.id, users.displayName, users.avatarUrl)
    .orderBy(sql`coalesce(sum(${predictions.pointsGlobal}), 0) desc`)

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
    }
  })
}
