import { eq, isNull, sql, count, and, or } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions, groupMembers, groups, scoringConfigs, groupPredictionPoints, specialPredictions, specialPredictionTypes, groupGlobalTypeSubscriptions } from '../db/schema/index.js'
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
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
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

  const hasGroupConfig = group[0].scoringConfigId !== null

  let rows: Array<{
    userId: string
    displayName: string
    avatarUrl: string | null
    totalPoints: number
    predictionCount: number
    correctCount: number
  }>

  if (hasGroupConfig) {
    rows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        totalPoints: sql<number>`coalesce(sum(${groupPredictionPoints.points}), 0)`,
        predictionCount: count(groupPredictionPoints.id),
        correctCount: sql<number>`count(case when ${groupPredictionPoints.points} > 0 then 1 end)`,
      })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .leftJoin(predictions, eq(predictions.userId, users.id))
      .leftJoin(
        groupPredictionPoints,
        sql`${groupPredictionPoints.predictionId} = ${predictions.id} AND ${groupPredictionPoints.groupId} = ${groupId}::uuid`,
      )
      .where(eq(groupMembers.groupId, groupId))
      .groupBy(users.id, users.displayName, users.avatarUrl)
      .orderBy(sql`coalesce(sum(${groupPredictionPoints.points}), 0) desc`)
  } else {
    rows = await db
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
  }

  // Fetch stat prediction points per user for this group
  // Includes both group-scoped types AND subscribed global types, filtered by sp.groupId
  const statPointRows = await db
    .select({
      userId: specialPredictions.userId,
      statPoints: sql<number>`coalesce(sum(${specialPredictions.points}), 0)`,
    })
    .from(specialPredictions)
    .innerJoin(specialPredictionTypes, eq(specialPredictions.typeId, specialPredictionTypes.id))
    .where(and(
      eq(specialPredictions.groupId, groupId),
      or(
        // Group-scoped types belonging to this group
        and(eq(specialPredictionTypes.groupId, groupId), eq(specialPredictionTypes.isGlobal, false)),
        // Global types subscribed by this group
        sql`(${specialPredictionTypes.isGlobal} = true AND ${specialPredictionTypes.id} IN (
          SELECT ${groupGlobalTypeSubscriptions.globalTypeId} FROM ${groupGlobalTypeSubscriptions}
          WHERE ${groupGlobalTypeSubscriptions.groupId} = ${groupId}::uuid
        ))`,
      ),
    ))
    .groupBy(specialPredictions.userId)

  const statPointsByUser = new Map(statPointRows.map(r => [r.userId, Number(r.statPoints)]))

  // Merge stat points and compute total
  const merged = rows.map(row => {
    const matchPoints = Number(row.totalPoints)
    const statPoints = statPointsByUser.get(row.userId) ?? 0
    return {
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? null,
      matchPoints,
      specialPredictionPoints: statPoints,
      totalPoints: matchPoints + statPoints,
      predictionCount: Number(row.predictionCount),
      correctCount: Number(row.correctCount),
    }
  })

  // Sort by total (match + stat) descending
  merged.sort((a, b) => b.totalPoints - a.totalPoints)

  let rank = 1
  return merged.map((row, i) => {
    if (i > 0 && row.totalPoints < merged[i - 1]!.totalPoints) {
      rank = i + 1
    }
    return {
      rank,
      userId: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      totalPoints: row.totalPoints,
      predictionCount: row.predictionCount,
      correctCount: row.correctCount,
      specialPredictionPoints: row.specialPredictionPoints,
    }
  })
}
