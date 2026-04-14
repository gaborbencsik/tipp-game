import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { scoringConfigs } from '../db/schema/index.js'
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
