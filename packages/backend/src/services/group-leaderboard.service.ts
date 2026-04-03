import { eq, isNull, sql, count } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions, groupMembers, groups } from '../db/schema/index.js'
import type { LeaderboardEntry } from './leaderboard.service.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

export async function getGroupLeaderboard(groupId: string, requesterId: string): Promise<LeaderboardEntry[]> {
  const group = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!group[0]) throw new AppError(404, 'Group not found')

  const membership = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))

  const memberIds = membership.map(m => m.userId)
  if (!memberIds.includes(requesterId)) throw new AppError(403, 'Not a member of this group')

  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      totalPoints: sql<number>`coalesce(sum(${predictions.pointsGlobal}), 0)`,
      predictionCount: count(predictions.id),
      correctCount: sql<number>`count(case when ${predictions.pointsGlobal} > 0 then 1 end)`,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(predictions, eq(predictions.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
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
