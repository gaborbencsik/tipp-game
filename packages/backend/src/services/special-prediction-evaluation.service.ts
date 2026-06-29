import { and, eq, isNull, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { auditLogs, groupMembers, specialPredictionTypes, specialPredictions, users } from '../db/schema/index.js'
import type { SpecialPredictionType, SpecialPredictionOptions, SpecialPredictionInputType, AllGroupsStandingAnswer, BracketMatch, BracketProgressionAnswer } from '../types/index.js'
import { deriveEliminatedFromBracket, parseUpsetEliminated, parseUpsetPicks, scoreUpsetSpecial, validateUpsetOptions } from './upset-special.service.js'
import {
  parseBracketProgressionAnswer,
  scoreBracketProgression,
  validateBracketProgressionOptions,
} from './bracket-progression.service.js'
import { parseAllGroupsStandingAnswer, validateAllGroupsStandingOptions } from './group-standings.service.js'
import { scoreAllGroupsStanding } from './tournament-scoring.service.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

const normalize = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * UX-037: parse a stored `correctAnswer` into the set of accepted strings.
 * - JSON-array (`["a","b",...]`) → array of non-empty trimmed strings (tie handling).
 * - Anything else → `[correctAnswer]` (backward compatible single-value form).
 *
 * Malformed JSON or non-array JSON falls back to the single-string interpretation,
 * preserving existing behaviour for free-text answers that happen to look JSON-ish.
 */
export function parseCorrectAnswerSet(raw: string): readonly string[] {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === 'string')
          .map(v => v.trim())
          .filter(v => v.length > 0)
      }
    } catch {
      // fall through to single-string treatment
    }
  }
  return [raw]
}

export function evaluateSpecialPrediction(
  answer: string,
  correctAnswer: string,
  maxPoints: number,
): number {
  const candidates = parseCorrectAnswerSet(correctAnswer)
  if (candidates.length === 0) return 0
  const normalizedAnswer = normalize(answer)
  if (normalizedAnswer.length === 0) return 0
  return candidates.some(c => normalize(c) === normalizedAnswer) ? maxPoints : 0
}

/**
 * Optional context for `scorePrediction`. The bracket_progression scorer needs the
 * companion all_groups_standing answers (user's + correct) to derive participating teams.
 * The multi_team_weighted (Upset) scorer can derive the eliminated set from the correct
 * bracket — `correctBracket` + `correctBracketTemplate` enable that auto-derivation.
 */
export interface ScoringContext {
  readonly userGroupStandings?: AllGroupsStandingAnswer | null
  readonly correctGroupStandings?: AllGroupsStandingAnswer | null
  readonly correctBracket?: BracketProgressionAnswer | null
  readonly correctBracketTemplate?: readonly BracketMatch[] | null
}

function scorePrediction(
  inputType: SpecialPredictionInputType,
  options: unknown,
  answer: string,
  correctAnswer: string,
  maxPoints: number,
  context: ScoringContext = {},
): number {
  if (inputType === 'multi_team_weighted') {
    const opts = validateUpsetOptions(options)
    if (!opts) return 0
    const picks = parseUpsetPicks(answer) ?? []
    // Prefer auto-derivation from the correct bracket — "eliminated" = choices not in last_32.
    // Fall back to a manually-set correctAnswer (legacy: explicit JSON array).
    const derived = deriveEliminatedFromBracket(
      opts,
      context.correctBracketTemplate ?? null,
      context.correctGroupStandings ?? null,
      context.correctBracket ?? null,
    )
    const eliminated = derived ?? parseUpsetEliminated(correctAnswer)
    return scoreUpsetSpecial(picks, eliminated, opts.choices)
  }
  if (inputType === 'bracket_progression') {
    const opts = validateBracketProgressionOptions(options)
    if (!opts) return 0
    const predicted = parseBracketProgressionAnswer(answer) ?? { winners: {} }
    const correct = parseBracketProgressionAnswer(correctAnswer) ?? { winners: {} }
    return scoreBracketProgression(
      predicted,
      correct,
      opts.bracketTemplate.matches,
      context.userGroupStandings ?? null,
      context.correctGroupStandings ?? null,
    )
  }
  if (inputType === 'all_groups_standing') {
    const opts = validateAllGroupsStandingOptions(options)
    if (!opts) return 0
    const predicted = parseAllGroupsStandingAnswer(answer)
    const correct = parseAllGroupsStandingAnswer(correctAnswer)
    return scoreAllGroupsStanding(predicted, correct, opts.groups)
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

  return toSpecialPredictionType(updatedType)
}

/**
 * @deprecated Backward-compatible: PUT /admin/global-special-types/:typeId/answer.
 * Prefer `setGlobalCorrectAnswer` + `evaluateGlobalTypeSlice` from US-1311.
 */
export async function evaluateGlobalType(
  typeId: string,
  correctAnswer: string,
): Promise<SpecialPredictionType> {
  await setGlobalCorrectAnswer(typeId, correctAnswer)
  return runGlobalRecompute(typeId)
}

/**
 * US-1311: persist `correctAnswer` for a global type. Does NOT recompute prediction points;
 * use `evaluateGlobalTypeSlice` for that.
 */
export async function setGlobalCorrectAnswer(
  typeId: string,
  correctAnswer: string,
): Promise<SpecialPredictionType> {
  // UX-037: reject empty JSON-array form (`[]`) — it would silently zero out every user's points.
  // Single empty string is allowed (legacy: clears the answer).
  const trimmed = correctAnswer.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        const meaningful = parsed
          .filter((v): v is string => typeof v === 'string')
          .map(v => v.trim())
          .filter(v => v.length > 0)
        if (meaningful.length === 0) {
          throw new AppError(400, 'Helyes válasz nem lehet üres')
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err
      // Malformed JSON — fall through and persist as-is (backward compatible).
    }
  }

  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.isGlobal, true)))
    .limit(1)
  if (!typeRows[0]) throw new AppError(404, 'Global special prediction type not found')

  const updated = await db
    .update(specialPredictionTypes)
    .set({ correctAnswer, updatedAt: new Date() })
    .where(eq(specialPredictionTypes.id, typeId))
    .returning()

  const updatedType = updated[0]
  if (!updatedType) throw new AppError(500, 'Failed to update correct answer')
  return toSpecialPredictionType(updatedType)
}

export interface EvaluationResult {
  readonly evaluatedCount: number
  readonly totalPoints: number
  readonly lastRunAt: string
}

/**
 * US-1311: per-slice evaluation of a global tournament type. The slice is purely a
 * UI-level handle for "which sub-section did the admin click?" — internally the full type
 * score is recomputed for every active user, ensuring repeated runs are idempotent.
 *
 * The slice value is recorded in the audit log so downstream tooling can see which button
 * triggered the run, but it does NOT restrict the calculation.
 */
export async function evaluateGlobalTypeSlice(
  typeId: string,
  slice: string | null,
  actorId: string,
  ipAddress?: string,
): Promise<EvaluationResult> {
  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.isGlobal, true)))
    .limit(1)
  if (!typeRows[0]) throw new AppError(404, 'Global special prediction type not found')

  const type = typeRows[0]
  if (!type.isActive) throw new AppError(400, 'Type is inactive')
  // multi_team_weighted derives `eliminated` from the correct bracket answer, so it does
  // NOT require an explicit correctAnswer on its own row — but it does require the two
  // upstream types (all_groups_standing + bracket_progression) to have their correctAnswer
  // populated, otherwise there is nothing to derive from.
  if (type.inputType !== 'multi_team_weighted') {
    if (!type.correctAnswer || type.correctAnswer.trim().length === 0) {
      throw new AppError(400, 'correctAnswer is not set on this type')
    }
  } else {
    const upstreamGroupStandings = await loadCorrectGroupStandings()
    if (!upstreamGroupStandings) {
      throw new AppError(400, 'Csoport végeredmény helyes válasza még nincs beírva — előbb azt kell rögzíteni')
    }
    const upstreamBracket = await loadCorrectBracket()
    if (!upstreamBracket?.template || upstreamBracket.template.length === 0) {
      throw new AppError(400, 'Bracket-progresszió típus nem található')
    }
    const eliminated = deriveEliminatedFromBracket(
      validateUpsetOptions(type.options) ?? { maxPicks: 0, minPicks: 0, choices: [] },
      upstreamBracket.template,
      upstreamGroupStandings,
      upstreamBracket.answer,
    )
    if (eliminated === null) {
      throw new AppError(400, 'Bracket-progresszió helyes válasza még nincs beírva — előbb a 32-be jutókat kell rögzíteni')
    }
  }

  const result = await runGlobalRecomputeInternal(type)

  await db.insert(auditLogs).values({
    actorId,
    action: 'result_set',
    entityType: 'special_prediction_type',
    entityId: typeId,
    previousValue: null,
    newValue: { slice: slice ?? null, evaluatedCount: result.evaluatedCount, totalPoints: result.totalPoints },
    ipAddress: ipAddress ?? null,
  })

  return result
}

/** Re-evaluate every (non-soft-deleted user) prediction for a global type. */
async function runGlobalRecompute(typeId: string): Promise<SpecialPredictionType> {
  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(eq(specialPredictionTypes.id, typeId), eq(specialPredictionTypes.isGlobal, true)))
    .limit(1)
  if (!typeRows[0]) throw new AppError(404, 'Global special prediction type not found')
  const type = typeRows[0]
  if (!type.correctAnswer || type.correctAnswer.trim().length === 0) {
    return toSpecialPredictionType(type)
  }
  await runGlobalRecomputeInternal(type)
  return toSpecialPredictionType(type)
}

interface SpecialPredictionTypeRow {
  readonly id: string
  readonly groupId: string | null
  readonly name: string
  readonly description: string | null
  readonly inputType: string
  readonly options: unknown
  readonly deadline: Date
  readonly points: number
  readonly correctAnswer: string | null
  readonly isGlobal: boolean
  readonly isActive: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

async function runGlobalRecomputeInternal(type: SpecialPredictionTypeRow): Promise<EvaluationResult> {
  const correctAnswer = type.correctAnswer ?? ''
  const needsCorrectBracketCtx = type.inputType === 'bracket_progression' || type.inputType === 'multi_team_weighted'
  const correctGroupStandings = needsCorrectBracketCtx
    ? await loadCorrectGroupStandings()
    : null
  const correctBracketCtx = type.inputType === 'multi_team_weighted'
    ? await loadCorrectBracket()
    : null

  const preds = await db
    .select({
      id: specialPredictions.id,
      userId: specialPredictions.userId,
      answer: specialPredictions.answer,
    })
    .from(specialPredictions)
    .innerJoin(users, eq(users.id, specialPredictions.userId))
    .where(and(
      eq(specialPredictions.typeId, type.id),
      isNull(users.deletedAt),
    ))

  // For bracket_progression, batch-load every active user's all_groups_standing answer.
  const userGroupStandingsByUserId = type.inputType === 'bracket_progression'
    ? await loadUserGroupStandingsByUser(preds.map(p => p.userId))
    : new Map<string, AllGroupsStandingAnswer | null>()

  const lastRunAt = new Date()
  let totalPoints = 0
  let evaluatedCount = 0

  for (const pred of preds) {
    let ctx: ScoringContext = {}
    if (type.inputType === 'bracket_progression') {
      ctx = {
        userGroupStandings: userGroupStandingsByUserId.get(pred.userId) ?? null,
        correctGroupStandings,
      }
    } else if (type.inputType === 'multi_team_weighted') {
      ctx = {
        correctGroupStandings,
        correctBracket: correctBracketCtx?.answer ?? null,
        correctBracketTemplate: correctBracketCtx?.template ?? null,
      }
    }
    const points = scorePrediction(
      type.inputType as SpecialPredictionInputType,
      type.options,
      pred.answer,
      correctAnswer,
      type.points,
      ctx,
    )
    await db
      .update(specialPredictions)
      .set({ points, updatedAt: lastRunAt })
      .where(eq(specialPredictions.id, pred.id))
    totalPoints += points
    evaluatedCount += 1
  }

  return {
    evaluatedCount,
    totalPoints,
    lastRunAt: lastRunAt.toISOString(),
  }
}

async function loadCorrectBracket(): Promise<{ answer: BracketProgressionAnswer | null; template: readonly BracketMatch[] | null } | null> {
  const rows = await db
    .select({ correctAnswer: specialPredictionTypes.correctAnswer, options: specialPredictionTypes.options })
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.inputType, 'bracket_progression'),
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  const opts = validateBracketProgressionOptions(row.options)
  if (!opts) return null
  const answer = row.correctAnswer ? parseBracketProgressionAnswer(row.correctAnswer) : null
  return { answer, template: opts.bracketTemplate.matches }
}

async function loadCorrectGroupStandings(): Promise<AllGroupsStandingAnswer | null> {
  const rows = await db
    .select({ correctAnswer: specialPredictionTypes.correctAnswer })
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.inputType, 'all_groups_standing'),
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .limit(1)
  const answer = rows[0]?.correctAnswer
  if (!answer) return null
  return parseAllGroupsStandingAnswer(answer)
}

async function loadUserGroupStandingsByUser(
  userIds: readonly string[],
): Promise<Map<string, AllGroupsStandingAnswer | null>> {
  const result = new Map<string, AllGroupsStandingAnswer | null>()
  if (userIds.length === 0) return result

  const typeRows = await db
    .select({ id: specialPredictionTypes.id })
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.inputType, 'all_groups_standing'),
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .limit(1)
  const groupStandingTypeId = typeRows[0]?.id
  if (!groupStandingTypeId) return result

  const predRows = await db
    .select({ userId: specialPredictions.userId, answer: specialPredictions.answer })
    .from(specialPredictions)
    .where(and(
      eq(specialPredictions.typeId, groupStandingTypeId),
      inArray(specialPredictions.userId, [...userIds]),
    ))

  for (const row of predRows) {
    result.set(row.userId, parseAllGroupsStandingAnswer(row.answer))
  }
  return result
}

function toSpecialPredictionType(row: SpecialPredictionTypeRow): SpecialPredictionType {
  return {
    id: row.id,
    groupId: row.groupId ?? null,
    name: row.name,
    description: row.description ?? null,
    inputType: row.inputType as SpecialPredictionInputType,
    options: row.options as SpecialPredictionOptions,
    deadline: row.deadline.toISOString(),
    points: row.points,
    correctAnswer: row.correctAnswer ?? null,
    isGlobal: row.isGlobal,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
