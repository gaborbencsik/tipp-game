import { and, eq, isNull, sql, min, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, groupMembers, users, specialPredictionTypes, groupGlobalTypeSubscriptions, groupLeagues, leagues, matches, auditLogs } from '../db/schema/index.js'
import type { Group, GroupInput, GroupMember, LeagueType } from '../types/index.js'
import { getGroupLeaderboard } from './group-leaderboard.service.js'
import { replicateUserTipsToGroup } from './tournament-tips-replication.service.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

const MAX_GROUPS_CREATED = 20
const MAX_GROUPS_JOINED = 20
const INVITE_CODE_LENGTH = 8
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)]
  }
  return code
}

type GroupLeague = { id: string; name: string; shortName: string; status: 'active' | 'archived'; type: LeagueType }

async function fetchGroupLeagues(groupId: string): Promise<GroupLeague[]> {
  return db
    .select({ id: leagues.id, name: leagues.name, shortName: leagues.shortName, status: leagues.status, type: leagues.type })
    .from(groupLeagues)
    .innerJoin(leagues, eq(groupLeagues.leagueId, leagues.id))
    .where(eq(groupLeagues.groupId, groupId))
}

function toApiGroup(
  row: typeof groups.$inferSelect,
  memberCount: number,
  isAdmin: boolean,
  userRank: number | null = null,
  groupLeaguesList: GroupLeague[] = [],
): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    inviteCode: row.inviteCode,
    inviteActive: row.inviteActive,
    createdBy: row.createdBy,
    memberCount,
    isAdmin,
    userRank,
    favoriteTeamDoublePoints: row.favoriteTeamDoublePoints,
    leagues: groupLeaguesList,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function getMyGroups(userId: string): Promise<Group[]> {
  const memberships = await db
    .select({
      group: groups,
      isAdmin: groupMembers.isAdmin,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .orderBy(groups.createdAt)

  const result: Group[] = []
  for (const { group, isAdmin } of memberships) {
    if (group.deletedAt) continue
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id))
    const memberCount = countRows[0]?.count ?? 0

    const league = await fetchGroupLeagues(group.id)

    let userRank: number | null = null
    try {
      const leaderboard = await getGroupLeaderboard(group.id, userId)
      const entry = leaderboard.find((e) => e.userId === userId)
      userRank = entry?.rank ?? null
    } catch {
      // If leaderboard fails (e.g. no predictions yet), rank stays null
    }

    result.push(toApiGroup(group, memberCount, isAdmin, userRank, league))
  }
  return result
}

export async function createGroup(input: GroupInput, userId: string): Promise<Group> {
  const leagueIds = Array.from(new Set(input.leagueIds ?? [])).filter((id) => id.length > 0)
  if (leagueIds.length === 0) {
    throw new AppError(422, 'A league must be selected')
  }

  const createdCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groups)
    .where(and(eq(groups.createdBy, userId), isNull(groups.deletedAt)))

  if ((createdCount[0]?.count ?? 0) >= MAX_GROUPS_CREATED) {
    throw new AppError(422, 'Maximum number of created groups reached')
  }

  let inviteCode = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const existing = await db
      .select()
      .from(groups)
      .where(eq(groups.inviteCode, inviteCode))
      .limit(1)
    if (!existing[0]) break
    inviteCode = generateInviteCode()
    attempts++
  }

  const groupRows = await db
    .insert(groups)
    .values({
      name: input.name,
      description: input.description ?? null,
      inviteCode,
      createdBy: userId,
    })
    .returning()

  const group = groupRows[0]
  if (!group) throw new AppError(500, 'Failed to create group')

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId,
    isAdmin: true,
  })

  const globalTypes = await db
    .select({ id: specialPredictionTypes.id })
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))

  if (globalTypes.length > 0) {
    const firstMatchRow = await db
      .select({ first: min(matches.scheduledAt) })
      .from(matches)
      .where(and(inArray(matches.leagueId, leagueIds), isNull(matches.deletedAt)))
    const deadlineOverride = firstMatchRow[0]?.first ?? null

    await db
      .insert(groupGlobalTypeSubscriptions)
      .values(globalTypes.map(gt => ({
        groupId: group.id,
        globalTypeId: gt.id,
        deadlineOverride,
      })))
      .onConflictDoNothing()
  }

  await db.insert(groupLeagues).values(leagueIds.map((leagueId) => ({ groupId: group.id, leagueId })))

  await replicateUserTipsToGroup(userId, group.id)

  const league = await fetchGroupLeagues(group.id)

  return toApiGroup(group, 1, true, null, league)
}

export async function joinGroup(inviteCode: string, userId: string): Promise<Group> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, inviteCode))
    .limit(1)

  const group = groupRows[0]
  if (!group || group.deletedAt) throw new AppError(404, 'Group not found')
  if (!group.inviteActive) throw new AppError(410, 'Invite code is no longer active')

  const existingMembership = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
    .limit(1)

  if (existingMembership.length > 0) throw new AppError(409, 'Already a member of this group')

  const joinedCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))

  if ((joinedCountRows[0]?.count ?? 0) >= MAX_GROUPS_JOINED) {
    throw new AppError(422, 'Maximum number of joined groups reached')
  }

  await db.insert(groupMembers).values({
    groupId: group.id,
    userId,
    isAdmin: false,
  })

  await replicateUserTipsToGroup(userId, group.id)

  const memberCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id))
  const memberCount = memberCountRows[0]?.count ?? 1

  const league = await fetchGroupLeagues(group.id)
  return toApiGroup(group, memberCount, false, null, league)
}

export async function getGroupMembers(groupId: string, requesterId: string): Promise<GroupMember[]> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const rows = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isAdmin: groupMembers.isAdmin,
      paidAt: groupMembers.paidAt,
      supporterAt: users.supporterAt,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.joinedAt)

  const requester = rows.find((r) => r.userId === requesterId)
  if (!requester) throw new AppError(403, 'Not a member of this group')

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl ?? null,
    isAdmin: r.isAdmin,
    isPaid: r.paidAt !== null,
    isSupporter: r.supporterAt !== null,
    joinedAt: r.joinedAt.toISOString(),
  }))
}

export async function removeMember(groupId: string, targetUserId: string, requesterId: string): Promise<void> {
  if (targetUserId === requesterId) throw new AppError(403, 'Cannot remove yourself')

  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))

  const requester = members.find((m) => m.userId === requesterId)
  if (!requester || !requester.isAdmin) throw new AppError(403, 'Not authorized')

  const target = members.find((m) => m.userId === targetUserId)
  if (!target) throw new AppError(404, 'Member not found')

  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)))
}

export async function setMemberAdmin(
  groupId: string,
  targetUserId: string,
  isAdmin: boolean,
  requesterId: string,
): Promise<GroupMember> {
  if (targetUserId === requesterId) throw new AppError(403, 'Cannot change your own admin status')

  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const rows = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isAdmin: groupMembers.isAdmin,
      paidAt: groupMembers.paidAt,
      supporterAt: users.supporterAt,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))

  const requester = rows.find((r) => r.userId === requesterId)
  if (!requester || !requester.isAdmin) throw new AppError(403, 'Not authorized')

  const target = rows.find((r) => r.userId === targetUserId)
  if (!target) throw new AppError(404, 'Member not found')

  if (!isAdmin) {
    const adminCount = rows.filter((r) => r.isAdmin).length
    if (adminCount === 1 && target.isAdmin) throw new AppError(422, 'Cannot demote the last admin')
  }

  const updated = await db
    .update(groupMembers)
    .set({ isAdmin })
    .where(eq(groupMembers.id, target.id))
    .returning()

  const updatedRow = updated[0]
  if (!updatedRow) throw new AppError(500, 'Failed to update member role')

  return {
    id: target.id,
    userId: target.userId,
    displayName: target.displayName,
    avatarUrl: target.avatarUrl ?? null,
    isAdmin: updatedRow.isAdmin,
    isPaid: target.paidAt !== null,
    isSupporter: target.supporterAt !== null,
    joinedAt: target.joinedAt.toISOString(),
  }
}

export async function setMemberPaidStatus(
  groupId: string,
  targetUserId: string,
  paid: boolean,
  actorId: string,
): Promise<GroupMember> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const memberRows = await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isAdmin: groupMembers.isAdmin,
      paidAt: groupMembers.paidAt,
      supporterAt: users.supporterAt,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)))
    .limit(1)

  const target = memberRows[0]
  if (!target) throw new AppError(404, 'Member not found')

  const previousPaidAt = target.paidAt
  const newPaidAt = paid ? new Date() : null

  const updated = await db
    .update(groupMembers)
    .set({ paidAt: newPaidAt })
    .where(eq(groupMembers.id, target.id))
    .returning()

  const updatedRow = updated[0]
  if (!updatedRow) throw new AppError(500, 'Failed to update member paid status')

  await db.insert(auditLogs).values({
    actorId,
    action: 'group_member_paid_set',
    entityType: 'group_member',
    entityId: target.id,
    previousValue: { paidAt: previousPaidAt?.toISOString() ?? null, groupId, userId: targetUserId },
    newValue: { paidAt: newPaidAt?.toISOString() ?? null, groupId, userId: targetUserId },
  })

  return {
    id: target.id,
    userId: target.userId,
    displayName: target.displayName,
    avatarUrl: target.avatarUrl ?? null,
    isAdmin: target.isAdmin,
    isPaid: updatedRow.paidAt !== null,
    isSupporter: target.supporterAt !== null,
    joinedAt: target.joinedAt.toISOString(),
  }
}

async function getGroupWithAdminCheck(groupId: string, requesterId: string): Promise<{ group: typeof groups.$inferSelect; memberCount: number; isAdmin: boolean }> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))

  const requester = members.find((m) => m.userId === requesterId)
  if (!requester || !requester.isAdmin) throw new AppError(403, 'Not authorized')

  return { group: groupRows[0], memberCount: members.length, isAdmin: requester.isAdmin }
}

export async function regenerateInviteCode(groupId: string, requesterId: string): Promise<Group> {
  const { group, memberCount } = await getGroupWithAdminCheck(groupId, requesterId)

  let newCode = generateInviteCode()
  let attempts = 0
  while (attempts < 10) {
    const existing = await db
      .select()
      .from(groups)
      .where(eq(groups.inviteCode, newCode))
      .limit(1)
    if (!existing[0]) break
    newCode = generateInviteCode()
    attempts++
  }

  const updated = await db
    .update(groups)
    .set({ inviteCode: newCode, inviteActive: true })
    .where(eq(groups.id, group.id))
    .returning()

  const updatedGroup = updated[0]
  if (!updatedGroup) throw new AppError(500, 'Failed to regenerate invite code')

  const league = await fetchGroupLeagues(group.id)
  return toApiGroup(updatedGroup, memberCount, true, null, league)
}

export async function setInviteActive(groupId: string, active: boolean, requesterId: string): Promise<Group> {
  const { group, memberCount } = await getGroupWithAdminCheck(groupId, requesterId)

  const updated = await db
    .update(groups)
    .set({ inviteActive: active })
    .where(eq(groups.id, group.id))
    .returning()

  const updatedGroup = updated[0]
  if (!updatedGroup) throw new AppError(500, 'Failed to update invite status')

  const league2 = await fetchGroupLeagues(group.id)
  return toApiGroup(updatedGroup, memberCount, true, null, league2)
}

export async function deleteGroup(groupId: string, requesterId: string, isGlobalAdmin: boolean): Promise<void> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  if (!isGlobalAdmin) {
    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
    const requester = members.find((m) => m.userId === requesterId)
    if (!requester || !requester.isAdmin) throw new AppError(403, 'Not authorized')
  }

  await db
    .update(groups)
    .set({ deletedAt: new Date() })
    .where(eq(groups.id, groupId))
}

export interface GroupSettings {
  readonly favoriteTeamDoublePoints?: boolean
}

export async function updateGroupSettings(
  groupId: string,
  userId: string,
  settings: GroupSettings,
): Promise<Group> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const memberRows = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!memberRows[0]?.isAdmin) throw new AppError(403, 'Not authorized')

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (settings.favoriteTeamDoublePoints !== undefined) {
    updateData.favoriteTeamDoublePoints = settings.favoriteTeamDoublePoints
  }

  const updated = await db
    .update(groups)
    .set(updateData)
    .where(eq(groups.id, groupId))
    .returning()

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))

  const league = await fetchGroupLeagues(groupId)

  return toApiGroup(updated[0]!, countRows[0]?.count ?? 0, true, null, league)
}

async function recalcGroupSpecialDeadlines(groupId: string): Promise<void> {
  const leagueRows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  const leagueIds = leagueRows.map((r) => r.leagueId)
  if (leagueIds.length === 0) return

  const firstMatchRow = await db
    .select({ first: min(matches.scheduledAt) })
    .from(matches)
    .where(and(inArray(matches.leagueId, leagueIds), isNull(matches.deletedAt)))
  const deadlineOverride = firstMatchRow[0]?.first ?? null

  await db
    .update(groupGlobalTypeSubscriptions)
    .set({ deadlineOverride })
    .where(eq(groupGlobalTypeSubscriptions.groupId, groupId))
}

async function assertGroupAdmin(groupId: string, userId: string): Promise<typeof groups.$inferSelect> {
  const groupRows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const memberRows = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!memberRows[0]?.isAdmin) throw new AppError(403, 'Not authorized')

  return groupRows[0]
}

async function buildGroupResponse(row: typeof groups.$inferSelect): Promise<Group> {
  const league = await fetchGroupLeagues(row.id)
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, row.id))
  return toApiGroup(row, countRows[0]?.count ?? 0, true, null, league)
}

export async function addGroupLeague(
  groupId: string,
  leagueId: string,
  userId: string,
): Promise<Group> {
  if (!leagueId) {
    throw new AppError(422, 'A league must be selected')
  }

  const group = await assertGroupAdmin(groupId, userId)

  const leagueRows = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.id, leagueId))
    .limit(1)
  if (!leagueRows[0]) throw new AppError(404, 'League not found')

  const existing = await db
    .select({ id: groupLeagues.id })
    .from(groupLeagues)
    .where(and(eq(groupLeagues.groupId, groupId), eq(groupLeagues.leagueId, leagueId)))
    .limit(1)
  if (existing.length === 0) {
    await db.insert(groupLeagues).values({ groupId, leagueId })
    await recalcGroupSpecialDeadlines(groupId)
  }

  return buildGroupResponse(group)
}

export async function removeGroupLeague(
  groupId: string,
  leagueId: string,
  userId: string,
): Promise<Group> {
  const group = await assertGroupAdmin(groupId, userId)

  const currentLeagues = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))

  const hasLeague = currentLeagues.some((r) => r.leagueId === leagueId)
  if (hasLeague && currentLeagues.length <= 1) {
    throw new AppError(422, 'Cannot remove the last league')
  }

  if (hasLeague) {
    await db
      .delete(groupLeagues)
      .where(and(eq(groupLeagues.groupId, groupId), eq(groupLeagues.leagueId, leagueId)))
    await recalcGroupSpecialDeadlines(groupId)
  }

  return buildGroupResponse(group)
}