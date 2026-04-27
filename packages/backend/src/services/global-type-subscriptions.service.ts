import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, groupMembers, specialPredictionTypes, groupGlobalTypeSubscriptions } from '../db/schema/index.js'
import type { GlobalTypeWithSubscription } from '../types/index.js'
import { AppError } from './special-prediction-validation.js'

async function assertGroupExists(groupId: string): Promise<void> {
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Group not found')
}

async function assertGroupAdmin(groupId: string, userId: string): Promise<void> {
  const rows = await db
    .select({ isAdmin: groupMembers.isAdmin })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!rows[0]) throw new AppError(403, 'Not a member of this group')
  if (!rows[0].isAdmin) throw new AppError(403, 'Not a group admin')
}

export async function listAvailableGlobalTypes(
  groupId: string,
  requesterId: string,
): Promise<GlobalTypeWithSubscription[]> {
  await assertGroupExists(groupId)
  await assertGroupAdmin(groupId, requesterId)

  const globalTypes = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .orderBy(specialPredictionTypes.createdAt)

  const subs = await db
    .select({ globalTypeId: groupGlobalTypeSubscriptions.globalTypeId })
    .from(groupGlobalTypeSubscriptions)
    .where(eq(groupGlobalTypeSubscriptions.groupId, groupId))

  const subscribedIds = new Set(subs.map(s => s.globalTypeId))

  return globalTypes.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    inputType: t.inputType as 'text' | 'dropdown' | 'team_select',
    options: t.options as string[] | null,
    deadline: t.deadline.toISOString(),
    points: t.points,
    correctAnswer: t.correctAnswer ?? null,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    subscribed: subscribedIds.has(t.id),
  }))
}

export async function subscribeGroup(
  groupId: string,
  globalTypeId: string,
  requesterId: string,
): Promise<void> {
  await assertGroupExists(groupId)
  await assertGroupAdmin(groupId, requesterId)

  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.id, globalTypeId),
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .limit(1)
  if (!typeRows[0]) throw new AppError(404, 'Global type not found or not active')

  const existing = await db
    .select({ id: groupGlobalTypeSubscriptions.id })
    .from(groupGlobalTypeSubscriptions)
    .where(and(
      eq(groupGlobalTypeSubscriptions.groupId, groupId),
      eq(groupGlobalTypeSubscriptions.globalTypeId, globalTypeId),
    ))
    .limit(1)

  if (existing[0]) throw new AppError(409, 'Already subscribed to this global type')

  await db
    .insert(groupGlobalTypeSubscriptions)
    .values({ groupId, globalTypeId })
}

export async function unsubscribeGroup(
  groupId: string,
  globalTypeId: string,
  requesterId: string,
): Promise<void> {
  await assertGroupExists(groupId)
  await assertGroupAdmin(groupId, requesterId)

  const existing = await db
    .select({ id: groupGlobalTypeSubscriptions.id })
    .from(groupGlobalTypeSubscriptions)
    .where(and(
      eq(groupGlobalTypeSubscriptions.groupId, groupId),
      eq(groupGlobalTypeSubscriptions.globalTypeId, globalTypeId),
    ))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'Not subscribed to this global type')

  await db
    .delete(groupGlobalTypeSubscriptions)
    .where(and(
      eq(groupGlobalTypeSubscriptions.groupId, groupId),
      eq(groupGlobalTypeSubscriptions.globalTypeId, globalTypeId),
    ))
}
