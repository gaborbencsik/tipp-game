import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { scoringConfigs, groups } from '../db/schema/index.js'
import type { ScoringConfigFull, ScoringConfigInput } from '../types/index.js'

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
  }
}

export async function getGlobalConfig(): Promise<ScoringConfigFull> {
  const rows = await db
    .select()
    .from(scoringConfigs)
    .where(eq(scoringConfigs.isGlobalDefault, true))
    .limit(1)
  if (!rows[0]) throw new AppError(404, 'Global scoring config not found')
  return toApiConfig(rows[0])
}

export async function updateGlobalConfig(input: ScoringConfigInput): Promise<ScoringConfigFull> {
  const current = await getGlobalConfig()
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

export async function getGroupConfig(groupId: string): Promise<ScoringConfigFull | null> {
  const rows = await db
    .select({
      id: scoringConfigs.id,
      name: scoringConfigs.name,
      isGlobalDefault: scoringConfigs.isGlobalDefault,
      exactScore: scoringConfigs.exactScore,
      correctWinnerAndDiff: scoringConfigs.correctWinnerAndDiff,
      correctWinner: scoringConfigs.correctWinner,
      correctDraw: scoringConfigs.correctDraw,
      correctOutcome: scoringConfigs.correctOutcome,
      incorrect: scoringConfigs.incorrect,
      createdAt: scoringConfigs.createdAt,
      updatedAt: scoringConfigs.updatedAt,
      groupScoringConfigId: groups.scoringConfigId,
    })
    .from(groups)
    .leftJoin(scoringConfigs, eq(groups.scoringConfigId, scoringConfigs.id))
    .where(eq(groups.id, groupId))
    .limit(1)

  if (!rows[0]) throw new AppError(404, 'Group not found')
  if (!rows[0].groupScoringConfigId) return null
  return toApiConfig(rows[0] as typeof scoringConfigs.$inferSelect)
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
