import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, groupMembers, users } from '../db/schema/index.js'
import type { Group, GroupInput, GroupMember } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

const MAX_GROUPS_CREATED = 5
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

function toApiGroup(
  row: typeof groups.$inferSelect,
  memberCount: number,
  isAdmin: boolean,
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
    result.push(toApiGroup(group, memberCount, isAdmin))
  }
  return result
}

export async function createGroup(input: GroupInput, userId: string): Promise<Group> {
  const createdCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groups)
    .where(eq(groups.createdBy, userId))

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

  return toApiGroup(group, 1, true)
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

  const existing = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id))

  const alreadyMember = existing.some((m) => m.userId === userId)
  if (alreadyMember) throw new AppError(409, 'Already a member of this group')

  if (existing.length >= MAX_GROUPS_JOINED) {
    throw new AppError(422, 'Group is full')
  }

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

  const memberCount = existing.length + 1
  return toApiGroup(group, memberCount, false)
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
    joinedAt: target.joinedAt.toISOString(),
  }
}