import { eq, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, matches, predictions } from '../db/schema/index.js'
import type { MatchOutcome, Prediction, PredictionInput } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

async function findUserBySupabaseId(supabaseId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, supabaseId))
    .limit(1)
  const user = rows[0]
  if (!user) throw new AppError(404, 'User not found')
  return user
}

function toApiPrediction(row: typeof predictions.$inferSelect): Prediction {
  return {
    id: row.id,
    userId: row.userId,
    matchId: row.matchId,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    outcomeAfterDraw: (row.outcomeAfterDraw as MatchOutcome | null) ?? null,
    pointsGlobal: row.pointsGlobal ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function upsertPrediction(
  supabaseId: string,
  input: PredictionInput
): Promise<Prediction> {
  const user = await findUserBySupabaseId(supabaseId)

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.id, input.matchId))
    .limit(1)
  const match = matchRows[0]
  if (!match) throw new AppError(404, 'Match not found')

  if (match.status !== 'scheduled' || match.scheduledAt <= new Date()) {
    throw new AppError(409, 'Prediction deadline has passed')
  }

  const rows = await db
    .insert(predictions)
    .values({
      userId: user.id,
      matchId: input.matchId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      outcomeAfterDraw: input.outcomeAfterDraw ?? null,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId],
      set: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        outcomeAfterDraw: input.outcomeAfterDraw ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  const row = rows[0]
  if (!row) throw new AppError(500, 'Failed to save prediction')
  return toApiPrediction(row)
}

export async function getPredictionsForUser(
  requestingSupabaseId: string,
  targetUserId: string
): Promise<Prediction[]> {
  const requestingUser = await findUserBySupabaseId(requestingSupabaseId)

  const targetRows = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1)
  const targetUser = targetRows[0]
  if (!targetUser) throw new AppError(404, 'User not found')

  if (requestingUser.id !== targetUserId && requestingUser.role !== 'admin') {
    throw new AppError(403, 'Access denied')
  }

  const rows = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, targetUserId))
    .orderBy(predictions.createdAt)

  return rows.map(toApiPrediction)
}
