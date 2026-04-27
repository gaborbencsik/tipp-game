import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, groupMembers, specialPredictionTypes, specialPredictions, teams, groupGlobalTypeSubscriptions } from '../db/schema/index.js'
import type { SpecialPrediction, SpecialPredictionInput, SpecialPredictionWithType } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
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

export async function getMyPredictions(
  groupId: string,
  userId: string,
): Promise<SpecialPredictionWithType[]> {
  await assertGroupExists(groupId)
  await assertGroupMember(groupId, userId)

  // Group-scoped types
  const groupTypes = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.groupId, groupId),
      eq(specialPredictionTypes.isActive, true),
      eq(specialPredictionTypes.isGlobal, false),
    ))
    .orderBy(specialPredictionTypes.createdAt)

  // Subscribed global types
  const globalTypeRows = await db
    .select({ spt: specialPredictionTypes })
    .from(groupGlobalTypeSubscriptions)
    .innerJoin(specialPredictionTypes, eq(groupGlobalTypeSubscriptions.globalTypeId, specialPredictionTypes.id))
    .where(and(
      eq(groupGlobalTypeSubscriptions.groupId, groupId),
      eq(specialPredictionTypes.isActive, true),
      eq(specialPredictionTypes.isGlobal, true),
    ))

  const allTypes = [
    ...globalTypeRows.map(r => ({ ...r.spt, _isGlobal: true as const })),
    ...groupTypes.map(t => ({ ...t, _isGlobal: false as const })),
  ]

  if (allTypes.length === 0) return []

  const preds = await db
    .select()
    .from(specialPredictions)
    .where(and(eq(specialPredictions.userId, userId), eq(specialPredictions.groupId, groupId)))

  const predByTypeId = new Map(preds.map(p => [p.typeId, p]))

  return allTypes.map(t => {
    const pred = predByTypeId.get(t.id)
    const deadlinePassed = t.deadline <= new Date()
    return {
      id: pred?.id ?? null,
      typeId: t.id,
      typeName: t.name,
      typeDescription: t.description ?? null,
      inputType: t.inputType as 'text' | 'dropdown' | 'team_select',
      options: t.options as string[] | null,
      deadline: t.deadline.toISOString(),
      maxPoints: t.points,
      answer: pred?.answer ?? null,
      points: pred?.points ?? null,
      correctAnswer: (deadlinePassed || pred?.points !== null && pred?.points !== undefined) ? (t.correctAnswer ?? null) : null,
      isGlobal: t._isGlobal,
      createdAt: pred?.createdAt.toISOString() ?? null,
      updatedAt: pred?.updatedAt.toISOString() ?? null,
    }
  })
}

export async function upsertPrediction(
  groupId: string,
  userId: string,
  input: SpecialPredictionInput,
): Promise<SpecialPrediction> {
  await assertGroupExists(groupId)
  await assertGroupMember(groupId, userId)

  // Try group-scoped type first
  let typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.id, input.typeId),
      eq(specialPredictionTypes.groupId, groupId),
      eq(specialPredictionTypes.isActive, true),
      eq(specialPredictionTypes.isGlobal, false),
    ))
    .limit(1)

  // If not found, try global type with active subscription
  if (!typeRows[0]) {
    typeRows = await db
      .select({ spt: specialPredictionTypes })
      .from(specialPredictionTypes)
      .innerJoin(groupGlobalTypeSubscriptions, eq(groupGlobalTypeSubscriptions.globalTypeId, specialPredictionTypes.id))
      .where(and(
        eq(specialPredictionTypes.id, input.typeId),
        eq(specialPredictionTypes.isGlobal, true),
        eq(specialPredictionTypes.isActive, true),
        eq(groupGlobalTypeSubscriptions.groupId, groupId),
      ))
      .limit(1)
      .then(rows => rows.map(r => r.spt))
  }

  const type = typeRows[0]
  if (!type) throw new AppError(404, 'Special prediction type not found')

  if (type.deadline <= new Date()) {
    throw new AppError(409, 'Deadline has passed for this prediction type')
  }

  const answer = input.answer.trim()
  if (!answer || answer.length === 0) {
    throw new AppError(400, 'answer is required')
  }
  if (answer.length > 500) {
    throw new AppError(400, 'answer must be at most 500 characters')
  }

  if (type.inputType === 'dropdown') {
    const options = type.options as string[] | null
    if (!options || !options.includes(answer)) {
      throw new AppError(400, 'answer must be one of the available options')
    }
  }

  if (type.inputType === 'team_select') {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(answer)) {
      throw new AppError(400, 'Invalid team id')
    }
    const teamRows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, answer))
      .limit(1)
    if (!teamRows[0]) {
      throw new AppError(400, 'Invalid team id')
    }
  }

  const rows = await db
    .insert(specialPredictions)
    .values({
      userId,
      typeId: input.typeId,
      groupId,
      answer,
    })
    .onConflictDoUpdate({
      target: [specialPredictions.userId, specialPredictions.typeId, specialPredictions.groupId],
      set: {
        answer,
        updatedAt: new Date(),
      },
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to save prediction')

  return {
    id: row.id,
    userId: row.userId,
    typeId: row.typeId,
    answer: row.answer,
    points: row.points ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
