import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, groupMembers, specialPredictionTypes, groupGlobalTypeSubscriptions } from '../db/schema/index.js'
import type { SpecialPredictionType, SpecialTypeInput } from '../types/index.js'
import { AppError, validateSpecialTypeInput, VALID_INPUT_TYPES } from './special-prediction-validation.js'

function toApi(row: typeof specialPredictionTypes.$inferSelect): SpecialPredictionType {
  return {
    id: row.id,
    groupId: row.groupId ?? null,
    name: row.name,
    description: row.description ?? null,
    inputType: row.inputType as 'text' | 'dropdown' | 'team_select',
    options: row.options as string[] | null,
    deadline: row.deadline.toISOString(),
    points: row.points,
    correctAnswer: row.correctAnswer ?? null,
    isGlobal: row.isGlobal,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertGroupExists(groupId: string): Promise<void> {
  const rows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Group not found')
}

async function assertGroupMember(groupId: string, userId: string): Promise<void> {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!rows[0]) throw new AppError(403, 'Not a member of this group')
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

function validateInput(input: SpecialTypeInput): void {
  validateSpecialTypeInput(input)
}

export async function listActiveTypes(groupId: string, requesterId: string): Promise<SpecialPredictionType[]> {
  await assertGroupExists(groupId)
  await assertGroupMember(groupId, requesterId)

  // Group-scoped types
  const groupRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.groupId, groupId),
      eq(specialPredictionTypes.isActive, true),
      eq(specialPredictionTypes.isGlobal, false),
    ))
    .orderBy(specialPredictionTypes.createdAt)

  // Subscribed global types
  const globalRows = await db
    .select({ spt: specialPredictionTypes })
    .from(groupGlobalTypeSubscriptions)
    .innerJoin(specialPredictionTypes, eq(groupGlobalTypeSubscriptions.globalTypeId, specialPredictionTypes.id))
    .where(and(
      eq(groupGlobalTypeSubscriptions.groupId, groupId),
      eq(specialPredictionTypes.isActive, true),
      eq(specialPredictionTypes.isGlobal, true),
    ))

  const result = [
    ...globalRows.map(r => toApi(r.spt)),
    ...groupRows.map(toApi),
  ]

  return result
}

export async function createType(
  groupId: string,
  requesterId: string,
  input: SpecialTypeInput,
): Promise<SpecialPredictionType> {
  await assertGroupExists(groupId)
  await assertGroupAdmin(groupId, requesterId)
  validateInput(input)

  const deadlineDate = new Date(input.deadline)
  if (deadlineDate <= new Date()) {
    throw new AppError(400, 'deadline must be in the future')
  }

  const rows = await db
    .insert(specialPredictionTypes)
    .values({
      groupId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      inputType: input.inputType,
      options: input.inputType === 'dropdown' ? input.options : null,
      deadline: deadlineDate,
      points: input.points,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create special prediction type')

  return toApi(row)
}

export async function updateType(
  groupId: string,
  typeId: string,
  requesterId: string,
  input: Partial<SpecialTypeInput>,
): Promise<SpecialPredictionType> {
  await assertGroupExists(groupId)
  await assertGroupAdmin(groupId, requesterId)

  const existing = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.groupId, groupId)))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'Special prediction type not found')

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (input.name !== undefined) {
    if (!input.name || input.name.trim().length === 0) throw new AppError(400, 'name is required')
    if (input.name.length > 100) throw new AppError(400, 'name must be at most 100 characters')
    updates['name'] = input.name.trim()
  }
  if (input.description !== undefined) {
    updates['description'] = input.description?.trim() || null
  }
  if (input.inputType !== undefined) {
    if (!VALID_INPUT_TYPES.has(input.inputType)) throw new AppError(400, "inputType must be 'text', 'dropdown', or 'team_select'")
    updates['inputType'] = input.inputType
  }
  if (input.options !== undefined) {
    updates['options'] = input.options
  }
  if (input.deadline !== undefined) {
    updates['deadline'] = new Date(input.deadline)
  }
  if (input.points !== undefined) {
    if (typeof input.points !== 'number' || input.points < 1 || input.points > 100) {
      throw new AppError(400, 'points must be an integer between 1 and 100')
    }
    updates['points'] = input.points
  }

  const effectiveInputType = (updates['inputType'] as string | undefined) ?? existing[0].inputType
  const effectiveOptions = (updates['options'] as string[] | undefined) ?? existing[0].options as string[] | null
  if (effectiveInputType === 'dropdown') {
    if (!Array.isArray(effectiveOptions) || effectiveOptions.length < 2) {
      throw new AppError(400, 'dropdown type requires at least 2 options')
    }
  }

  const rows = await db
    .update(specialPredictionTypes)
    .set(updates)
    .where(eq(specialPredictionTypes.id, typeId))
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to update special prediction type')

  return toApi(row)
}

export async function deactivateType(
  groupId: string,
  typeId: string,
  requesterId: string,
): Promise<void> {
  await assertGroupExists(groupId)
  await assertGroupAdmin(groupId, requesterId)

  const existing = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.groupId, groupId)))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'Special prediction type not found')

  await db
    .update(specialPredictionTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(specialPredictionTypes.id, typeId))
}
