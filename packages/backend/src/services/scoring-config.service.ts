import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { scoringConfigs, groups, matchResults, predictions, groupMembers } from '../db/schema/index.js'
import type {
  ScoringConfigFull,
  ScoringConfigInput,
  ScoringConfigWithImpact,
} from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

function toApiConfig(row: typeof scoringConfigs.$inferSelect): ScoringConfigFull {
  return {
    id: row.id,
    name: row.name,
    exactScore: row.exactScore,
    correctWinnerAndDiff: row.correctWinnerAndDiff,
    correctWinner: row.correctWinner,
    correctDraw: row.correctDraw,
    correctOutcome: row.correctOutcome,
    incorrect: row.incorrect,
    frozenAt: row.frozenAt ? row.frozenAt.toISOString() : null,
  }
}

async function loadGlobalConfigRow(): Promise<typeof scoringConfigs.$inferSelect> {
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.isGlobalDefault, true))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Global scoring config not found')
  return rows[0]
}

async function loadGroupConfigRow(groupId: string): Promise<typeof scoringConfigs.$inferSelect | null> {
  const groupRows = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')
  if (!groupRows[0].scoringConfigId) return null

  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.id, groupRows[0].scoringConfigId))
    .limit(1)
  return rows[0] ?? null
}

function assertNotFrozen(row: typeof scoringConfigs.$inferSelect): void {
  if (row.frozenAt) {
    throw new AppError(409, 'Scoring config is frozen')
  }
}

async function countGlobalImpact(): Promise<{ matches: number; predictions: number }> {
  const matchRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchResults)
  const predRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictions)
  return {
    matches: Number(matchRow[0]?.count ?? 0),
    predictions: Number(predRow[0]?.count ?? 0),
  }
}

async function countGroupImpact(groupId: string): Promise<{ matches: number; predictions: number }> {
  const matchRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchResults)
  const predRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictions)
    .innerJoin(groupMembers, eq(groupMembers.userId, predictions.userId))
    .where(eq(groupMembers.groupId, groupId))
  return {
    matches: Number(matchRow[0]?.count ?? 0),
    predictions: Number(predRow[0]?.count ?? 0),
  }
}

export async function getGlobalConfig(): Promise<ScoringConfigFull> {
  return toApiConfig(await loadGlobalConfigRow())
}

export async function getGlobalConfigWithImpact(): Promise<ScoringConfigWithImpact> {
  const row = await loadGlobalConfigRow()
  const impact = await countGlobalImpact()
  return {
    ...toApiConfig(row),
    affectedMatches: impact.matches,
    affectedPredictions: impact.predictions,
  }
}

export async function updateGlobalConfig(input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const current = await loadGlobalConfigRow()
  assertNotFrozen(current)
  const updated = await db
    .update(scoringConfigs)
    .set({
      exactScore: input.exactScore,
      correctWinnerAndDiff: input.correctWinnerAndDiff,
      correctWinner: input.correctWinner,
      correctDraw: input.correctDraw,
      correctOutcome: input.correctOutcome,
      incorrect: input.incorrect,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, current.id))
    .returning()
  return toApiConfig(updated[0]!)
}

export async function overrideGlobalConfig(input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const current = await loadGlobalConfigRow()
  const updated = await db
    .update(scoringConfigs)
    .set({
      exactScore: input.exactScore,
      correctWinnerAndDiff: input.correctWinnerAndDiff,
      correctWinner: input.correctWinner,
      correctDraw: input.correctDraw,
      correctOutcome: input.correctOutcome,
      incorrect: input.incorrect,
      frozenAt: null,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, current.id))
    .returning()
  return toApiConfig(updated[0]!)
}

export async function getGroupConfig(groupId: string): Promise<ScoringConfigFull | null> {
  const row = await loadGroupConfigRow(groupId)
  return row ? toApiConfig(row) : null
}

export async function getGroupConfigWithImpact(groupId: string): Promise<ScoringConfigWithImpact | null> {
  const row = await loadGroupConfigRow(groupId)
  if (!row) return null
  const impact = await countGroupImpact(groupId)
  return {
    ...toApiConfig(row),
    affectedMatches: impact.matches,
    affectedPredictions: impact.predictions,
  }
}

export async function setGroupConfig(groupId: string, input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const groupRows = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const existingConfigId = groupRows[0].scoringConfigId

  if (!existingConfigId) {
    const inserted = await db
      .insert(scoringConfigs)
      .values({
        name: 'Group Override',
        isGlobalDefault: false,
        exactScore: input.exactScore,
        correctWinnerAndDiff: input.correctWinnerAndDiff,
        correctWinner: input.correctWinner,
        correctDraw: input.correctDraw,
        correctOutcome: input.correctOutcome,
        incorrect: input.incorrect,
      })
      .returning()

    const newConfig = inserted[0]!
    await db
      .update(groups)
      .set({ scoringConfigId: newConfig.id, updatedAt: new Date() })
      .where(eq(groups.id, groupId))

    return toApiConfig(newConfig)
  }

  const existingRows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.id, existingConfigId))
    .limit(1)
  if (existingRows[0]) assertNotFrozen(existingRows[0])

  const updated = await db
    .update(scoringConfigs)
    .set({
      exactScore: input.exactScore,
      correctWinnerAndDiff: input.correctWinnerAndDiff,
      correctWinner: input.correctWinner,
      correctDraw: input.correctDraw,
      correctOutcome: input.correctOutcome,
      incorrect: input.incorrect,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, existingConfigId))
    .returning()

  return toApiConfig(updated[0]!)
}

export async function overrideGroupConfig(groupId: string, input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const groupRows = await db
    .select({ id: groups.id, scoringConfigId: groups.scoringConfigId })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const existingConfigId = groupRows[0].scoringConfigId

  if (!existingConfigId) {
    const inserted = await db
      .insert(scoringConfigs)
      .values({
        name: 'Group Override',
        isGlobalDefault: false,
        exactScore: input.exactScore,
        correctWinnerAndDiff: input.correctWinnerAndDiff,
        correctWinner: input.correctWinner,
        correctDraw: input.correctDraw,
        correctOutcome: input.correctOutcome,
        incorrect: input.incorrect,
      })
      .returning()

    const newConfig = inserted[0]!
    await db
      .update(groups)
      .set({ scoringConfigId: newConfig.id, updatedAt: new Date() })
      .where(eq(groups.id, groupId))

    return toApiConfig(newConfig)
  }

  const updated = await db
    .update(scoringConfigs)
    .set({
      exactScore: input.exactScore,
      correctWinnerAndDiff: input.correctWinnerAndDiff,
      correctWinner: input.correctWinner,
      correctDraw: input.correctDraw,
      correctOutcome: input.correctOutcome,
      incorrect: input.incorrect,
      frozenAt: null,
      updatedAt: new Date(),
    })
    .where(eq(scoringConfigs.id, existingConfigId))
    .returning()

  return toApiConfig(updated[0]!)
}
