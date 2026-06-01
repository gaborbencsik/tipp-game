import { eq, isNull, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  scoringConfigs,
  groups,
  groupMembers,
  specialPredictionTypes,
  groupGlobalTypeSubscriptions,
} from '../db/schema/index.js'
import type {
  ScoringConfigFull,
  ScoringExplainerResponse,
  ScoringExplainerGroup,
  ScoringExplainerSpecialType,
} from '../types/index.js'

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

export async function getScoringExplainer(userId: string): Promise<ScoringExplainerResponse> {
  // TODO: implement in next task
  throw new Error('not implemented')
}
