import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groupMembers, specialPredictionTypes, specialPredictions } from '../db/schema/index.js'
import type { SpecialPredictionType, SpecialPredictionOptions, SpecialPredictionInputType } from '../types/index.js'
import { parseUpsetEliminated, parseUpsetPicks, scoreUpsetSpecial, validateUpsetOptions } from './upset-special.service.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

const normalize = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function evaluateSpecialPrediction(
  answer: string,
  correctAnswer: string,
  maxPoints: number,
): number {
  return normalize(answer) === normalize(correctAnswer) ? maxPoints : 0
}

function scorePrediction(
  inputType: SpecialPredictionInputType,
  options: unknown,
  answer: string,
  correctAnswer: string,
  maxPoints: number,
): number {
  if (inputType === 'multi_team_weighted') {
    const opts = validateUpsetOptions(options)
    if (!opts) return 0
    const picks = parseUpsetPicks(answer) ?? []
    const eliminated = parseUpsetEliminated(correctAnswer)
    return scoreUpsetSpecial(picks, eliminated, opts.choices)
  }
  return evaluateSpecialPrediction(answer, correctAnswer, maxPoints)
}

export async function setCorrectAnswer(
  groupId: string,
  typeId: string,
  requesterId: string,
  correctAnswer: string,
): Promise<SpecialPredictionType> {
  const memberRows = await db
    .select({ isAdmin: groupMembers.isAdmin })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, requesterId)))
    .limit(1)
  if (!memberRows[0]) throw new AppError(403, 'Not a member of this group')
  if (!memberRows[0].isAdmin) throw new AppError(403, 'Not a group admin')

  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.groupId, groupId)))
    .limit(1)
  if (!typeRows[0]) throw new AppError(404, 'Special prediction type not found')

  const type = typeRows[0]
  const maxPoints = type.points

  const updated = await db
    .update(specialPredictionTypes)
    .set({ correctAnswer, updatedAt: new Date() })
    .where(eq(specialPredictionTypes.id, typeId))
    .returning()

  const updatedType = updated[0]
  if (!updatedType) throw new AppError(500, 'Failed to update correct answer')

  const preds = await db
    .select()
    .from(specialPredictions)
    .where(eq(specialPredictions.typeId, typeId))

  for (const pred of preds) {
    const points = scorePrediction(
      type.inputType as SpecialPredictionInputType,
      type.options,
      pred.answer,
      correctAnswer,
      maxPoints,
    )
    await db
      .update(specialPredictions)
      .set({ points, updatedAt: new Date() })
      .where(eq(specialPredictions.id, pred.id))
  }

  return {
    id: updatedType.id,
    groupId: updatedType.groupId ?? null,
    name: updatedType.name,
    description: updatedType.description ?? null,
    inputType: updatedType.inputType as SpecialPredictionInputType,
    options: updatedType.options as SpecialPredictionOptions,
    deadline: updatedType.deadline.toISOString(),
    points: updatedType.points,
    correctAnswer: updatedType.correctAnswer ?? null,
    isGlobal: updatedType.isGlobal,
    isActive: updatedType.isActive,
    createdAt: updatedType.createdAt.toISOString(),
    updatedAt: updatedType.updatedAt.toISOString(),
  }
}

export async function evaluateGlobalType(
  typeId: string,
  correctAnswer: string,
): Promise<SpecialPredictionType> {
  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.isGlobal, true)))
    .limit(1)
  if (!typeRows[0]) throw new AppError(404, 'Global special prediction type not found')

  const type = typeRows[0]
  const maxPoints = type.points

  const updated = await db
    .update(specialPredictionTypes)
    .set({ correctAnswer, updatedAt: new Date() })
    .where(eq(specialPredictionTypes.id, typeId))
    .returning()

  const updatedType = updated[0]
  if (!updatedType) throw new AppError(500, 'Failed to update correct answer')

  const preds = await db
    .select()
    .from(specialPredictions)
    .where(eq(specialPredictions.typeId, typeId))

  for (const pred of preds) {
    const points = scorePrediction(
      type.inputType as SpecialPredictionInputType,
      type.options,
      pred.answer,
      correctAnswer,
      maxPoints,
    )
    await db
      .update(specialPredictions)
      .set({ points, updatedAt: new Date() })
      .where(eq(specialPredictions.id, pred.id))
  }

  return {
    id: updatedType.id,
    groupId: null,
    name: updatedType.name,
    description: updatedType.description ?? null,
    inputType: updatedType.inputType as SpecialPredictionInputType,
    options: updatedType.options as SpecialPredictionOptions,
    deadline: updatedType.deadline.toISOString(),
    points: updatedType.points,
    correctAnswer: updatedType.correctAnswer ?? null,
    isGlobal: true,
    isActive: updatedType.isActive,
    createdAt: updatedType.createdAt.toISOString(),
    updatedAt: updatedType.updatedAt.toISOString(),
  }
}
