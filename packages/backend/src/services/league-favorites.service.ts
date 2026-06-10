import { eq, and, inArray, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groupMembers, groupLeagues, groups, userLeagueFavorites, users } from '../db/schema/index.js'

export interface FavoriteMember {
  readonly userId: string
  readonly displayName: string
  readonly teamId: string
}

/**
 * Returns all users who have a favorite team set in the given league AND
 * are either the requester themselves or share at least one (non-deleted) group
 * with the requester that is linked to the same league.
 *
 * The `favoriteTeamDoublePoints` group setting is intentionally NOT used as a
 * filter — the indicator on match cards shows favorites regardless of the
 * double-points feature being enabled in any group.
 */
export async function getFavoritesForLeague(
  leagueId: string,
  requesterUserId: string,
): Promise<FavoriteMember[]> {
  // Step 1 — find the requester's groups that include this league (non-deleted groups only)
  const requesterGroups = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groupLeagues, eq(groupLeagues.groupId, groupMembers.groupId))
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(
      eq(groupMembers.userId, requesterUserId),
      eq(groupLeagues.leagueId, leagueId),
      isNull(groups.deletedAt),
    ))

  const groupIds = [...new Set(requesterGroups.map((r) => r.groupId))]

  // Step 2 — collect candidate user IDs: every member of those groups, plus the requester
  const candidateIds = new Set<string>([requesterUserId])
  if (groupIds.length > 0) {
    const memberRows = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, groupIds))
    for (const row of memberRows) candidateIds.add(row.userId)
  }

  // Step 3 — favorites in this league for the candidate users
  const favRows = await db
    .select({
      userId: userLeagueFavorites.userId,
      displayName: users.displayName,
      teamId: userLeagueFavorites.teamId,
    })
    .from(userLeagueFavorites)
    .innerJoin(users, eq(users.id, userLeagueFavorites.userId))
    .where(and(
      eq(userLeagueFavorites.leagueId, leagueId),
      inArray(userLeagueFavorites.userId, [...candidateIds]),
      isNull(users.deletedAt),
    ))

  return favRows.map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    teamId: row.teamId,
  }))
}
