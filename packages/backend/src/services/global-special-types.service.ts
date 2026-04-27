import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { specialPredictionTypes } from '../db/schema/index.js'
import type { SpecialPredictionType, SpecialTypeInput } from '../types/index.js'
import { AppError, validateSpecialTypeInput } from './special-prediction-validation.js'

function toApi(row: typeof specialPredictionTypes.$inferSelect): SpecialPredictionType {
  return {
    id: row.id,
    groupId: null,
    name: row.name,
    description: row.description ?? null,
    inputType: row.inputType as 'text' | 'dropdown' | 'team_select',
    options: row.options as string[] | null,
    deadline: row.deadline.toISOString(),
    points: row.points,
    correctAnswer: row.correctAnswer ?? null,
    isGlobal: true,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listGlobalTypes(): Promise<SpecialPredictionType[]> {
  const rows = await db
    .select()
    .from(specialPredictionTypes)
    .where(eq(specialPredictionTypes.isGlobal, true))
    .orderBy(specialPredictionTypes.createdAt)

  return rows.map(toApi)
}

export async function createGlobalType(input: SpecialTypeInput): Promise<SpecialPredictionType> {
  validateSpecialTypeInput(input)

  const deadlineDate = new Date(input.deadline)
  if (deadlineDate <= new Date()) {
    throw new AppError(400, 'deadline must be in the future')
  }

  const rows = await db
    .insert(specialPredictionTypes)
    .values({
      groupId: null,
      isGlobal: true,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      inputType: input.inputType,
      options: input.inputType === 'dropdown' ? input.options : null,
      deadline: deadlineDate,
      points: input.points,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to create global special prediction type')

  return toApi(row)
}

export async function updateGlobalType(
  typeId: string,
  input: Partial<SpecialTypeInput>,
): Promise<SpecialPredictionType> {
  const existing = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.isGlobal, true)))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'Global special prediction type not found')

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
    const validTypes = new Set(['text', 'dropdown', 'team_select'])
    if (!validTypes.has(input.inputType)) throw new AppError(400, "inputType must be 'text', 'dropdown', or 'team_select'")
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
  if (!row) throw new AppError(500, 'Failed to update global special prediction type')

  return toApi(row)
}

export async function deactivateGlobalType(typeId: string): Promise<void> {
  const existing = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.isGlobal, true)))
    .limit(1)

  if (!existing[0]) throw new AppError(404, 'Global special prediction type not found')

  await db
    .update(specialPredictionTypes)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(specialPredictionTypes.id, typeId))
}
