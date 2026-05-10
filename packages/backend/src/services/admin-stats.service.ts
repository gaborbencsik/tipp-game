import { eq, sql, count, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, predictions, matches, matchResults, teams, groups, groupMembers } from '../db/schema/index.js'
import type { AdminStatsResponse, AdminStatsMatchesResponse, AdminStatsUser, AdminStatsMatch } from '../types/index.js'

export async function getAdminStats(): Promise<AdminStatsResponse> {
  const userRows = await db
    .select({
      id: users.id,
      avatarUrl: users.avatarUrl,
      displayName: users.displayName,
      isBanned: sql<boolean>`${users.bannedAt} is not null`,
      tipCount: sql<number>`count(${predictions.id})`,
      points: sql<number>`coalesce(sum(${predictions.pointsGlobal}), 0)`,
      lastActivity: sql<string | null>`max(${predictions.createdAt})`,
    })
    .from(users)
    .leftJoin(predictions, eq(predictions.userId, users.id))
    .where(isNull(users.deletedAt))
    .groupBy(users.id)

  const groupCountRows = await db
    .select({
      userId: groupMembers.userId,
      groupCount: count(groupMembers.id),
    })
    .from(groupMembers)
    .groupBy(groupMembers.userId)

  const groupCountMap = new Map(groupCountRows.map(r => [r.userId, Number(r.groupCount)]))

  const [matchCountRow] = await db
    .select({ matchCount: count(matches.id) })
    .from(matches)
    .where(isNull(matches.deletedAt))

  const matchCount = Number(matchCountRow?.matchCount ?? 0)

  const [activeRow] = await db
    .select({ activeCount: sql<number>`count(distinct ${predictions.userId})` })
    .from(predictions)
    .where(sql`${predictions.createdAt} > now() - interval '7 days'`)

  const [groupStatsRow] = await db
    .select({
      groupCount: count(groups.id),
    })
    .from(groups)
    .where(isNull(groups.deletedAt))

  const [avgGroupRow] = await db
    .select({
      avgSize: sql<number>`coalesce(avg(sub.cnt), 0)`,
    })
    .from(
      sql`(select count(*) as cnt from group_members group by group_id) as sub`
    )

  const userCount = userRows.length
  const predictionCount = userRows.reduce((sum, r) => sum + Number(r.tipCount), 0)
  const fillRate = userCount > 0 && matchCount > 0
    ? Math.round((predictionCount / (userCount * matchCount)) * 100)
    : 0
  const zeroTipUsers = userRows.filter(r => Number(r.tipCount) === 0).length

  const statsUsers: AdminStatsUser[] = userRows.map(r => ({
    id: r.id,
    avatarUrl: r.avatarUrl,
    displayName: r.displayName,
    tipCount: Number(r.tipCount),
    fillPercent: matchCount > 0 ? Math.round((Number(r.tipCount) / matchCount) * 100) : 0,
    points: Number(r.points),
    groupCount: groupCountMap.get(r.id) ?? 0,
    lastActivity: r.lastActivity ? new Date(r.lastActivity).toISOString() : null,
    isBanned: Boolean(r.isBanned),
  }))

  return {
    summary: {
      userCount,
      activeUsers7d: Number(activeRow?.activeCount ?? 0),
      predictionCount,
      fillRate,
      groupCount: Number(groupStatsRow?.groupCount ?? 0),
      avgGroupSize: Math.round(Number(avgGroupRow?.avgSize ?? 0)),
      zeroTipUsers,
    },
    users: statsUsers,
  }
}

export async function getAdminStatsMatches(): Promise<AdminStatsMatchesResponse> {
  const [userCountRow] = await db
    .select({ cnt: count(users.id) })
    .from(users)
    .where(isNull(users.deletedAt))

  const totalUsers = Number(userCountRow?.cnt ?? 0)

  const rows = await db
    .select({
      matchId: matches.id,
      scheduledAt: matches.scheduledAt,
      homeTeamName: sql<string>`ht.name`,
      awayTeamName: sql<string>`at.name`,
      tippedCount: sql<number>`count(${predictions.id})`,
      homeGoals: matchResults.homeGoals,
      awayGoals: matchResults.awayGoals,
    })
    .from(matches)
    .innerJoin(sql`teams ht`, sql`ht.id = ${matches.homeTeamId}`)
    .innerJoin(sql`teams at`, sql`at.id = ${matches.awayTeamId}`)
    .leftJoin(predictions, eq(predictions.matchId, matches.id))
    .leftJoin(matchResults, eq(matchResults.matchId, matches.id))
    .where(isNull(matches.deletedAt))
    .groupBy(matches.id, sql`ht.name`, sql`at.name`, matches.scheduledAt, matchResults.homeGoals, matchResults.awayGoals)
    .orderBy(sql`${matches.scheduledAt} desc`)

  const statsMatches: AdminStatsMatch[] = rows.map(r => ({
    matchId: r.matchId,
    homeTeam: r.homeTeamName,
    awayTeam: r.awayTeamName,
    date: new Date(r.scheduledAt).toISOString(),
    tippedCount: Number(r.tippedCount),
    totalUsers,
    fillPercent: totalUsers > 0 ? Math.round((Number(r.tippedCount) / totalUsers) * 100) : 0,
    result: r.homeGoals != null && r.awayGoals != null ? `${r.homeGoals}-${r.awayGoals}` : null,
  }))

  return { matches: statsMatches }
}
