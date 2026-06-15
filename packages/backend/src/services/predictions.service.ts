import { eq, isNull, desc, sql, and, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, matches, predictions, players, groupMembers, groups } from '../db/schema/index.js'
import type { MatchOutcome, MatchPrediction, Prediction, PredictionInput } from '../types/index.js'
import { derivePointsResult } from './scoring.service.js'

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
  const pointsGlobal = row.pointsGlobal ?? null
  const scorerBonusPoints = row.scorerBonusPoints ?? null
  return {
    id: row.id,
    userId: row.userId,
    matchId: row.matchId,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    outcomeAfterDraw: (row.outcomeAfterDraw as MatchOutcome | null) ?? null,
    pointsGlobal,
    pointsResult: derivePointsResult(pointsGlobal, scorerBonusPoints),
    scorerPickPlayerId: row.scorerPickPlayerId ?? null,
    scorerPlayerNameSnapshot: row.scorerPlayerNameSnapshot ?? null,
    scorerBonusPoints,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function isValidGoal(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0
}

async function resolveScorerPick(
  scorerPickPlayerId: string | null | undefined,
  match: typeof matches.$inferSelect,
  homeGoals: unknown,
  awayGoals: unknown,
): Promise<{ playerId: string | null; nameSnapshot: string | null }> {
  if (scorerPickPlayerId === null || scorerPickPlayerId === undefined) {
    return { playerId: null, nameSnapshot: null }
  }

  if (!isValidGoal(homeGoals) || !isValidGoal(awayGoals)) {
    throw new AppError(400, 'scorer_requires_full_prediction')
  }

  const playerRows = await db
    .select()
    .from(players)
    .where(eq(players.id, scorerPickPlayerId))
    .limit(1)
  const player = playerRows[0]
  if (!player) {
    throw new AppError(400, 'scorer_player_not_in_match')
  }

  if (player.teamId !== match.homeTeamId && player.teamId !== match.awayTeamId) {
    throw new AppError(400, 'scorer_player_not_in_match')
  }

  return { playerId: player.id, nameSnapshot: player.shortName ?? player.name }
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

  const scorer = await resolveScorerPick(
    input.scorerPickPlayerId,
    match,
    input.homeGoals,
    input.awayGoals,
  )

  const rows = await db
    .insert(predictions)
    .values({
      userId: user.id,
      matchId: input.matchId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      outcomeAfterDraw: input.outcomeAfterDraw ?? null,
      scorerPickPlayerId: scorer.playerId,
      scorerPlayerNameSnapshot: scorer.nameSnapshot,
    })
    .onConflictDoUpdate({
      target: [predictions.userId, predictions.matchId],
      set: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        outcomeAfterDraw: input.outcomeAfterDraw ?? null,
        scorerPickPlayerId: scorer.playerId,
        scorerPlayerNameSnapshot: scorer.nameSnapshot,
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

export async function getMatchPredictions(
  matchId: string,
  requesterUserId: string,
  groupId?: string,
): Promise<MatchPrediction[]> {
  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)
  const match = matchRows[0]
  if (!match) throw new AppError(404, 'Match not found')
  if (match.status === 'scheduled' && match.scheduledAt > new Date()) {
    throw new AppError(403, 'Predictions not available until match starts')
  }

  // Csoporttagok kigyűjtése: a kérelmezővel közös aktív csoportokban lévő userek.
  // Saját maga mindig benne van a végén egy fallback OR-ral, így ha a kérelmezőnek
  // nincs egyetlen csoportja sem, a saját tippje akkor is megjelenik.
  const requesterGroupRows = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, requesterUserId), isNull(groups.deletedAt)))
  const requesterGroupIds = requesterGroupRows.map(r => r.groupId)

  const visibleUserIds = new Set<string>([requesterUserId])
  if (requesterGroupIds.length > 0) {
    const peerRows = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(inArray(groupMembers.groupId, requesterGroupIds))
    for (const r of peerRows) visibleUserIds.add(r.userId)
  }

  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      supporterAt: users.supporterAt,
      homeGoals: predictions.homeGoals,
      awayGoals: predictions.awayGoals,
      pointsGlobal: predictions.pointsGlobal,
      scorerPickPlayerId: predictions.scorerPickPlayerId,
      scorerPlayerNameSnapshot: predictions.scorerPlayerNameSnapshot,
      scorerBonusPoints: predictions.scorerBonusPoints,
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(
      and(
        eq(predictions.matchId, matchId),
        inArray(predictions.userId, Array.from(visibleUserIds)),
      ),
    )
    .orderBy(sql`${predictions.pointsGlobal} desc nulls last`)

  const baseRows: MatchPrediction[] = rows.map(r => ({
    userId: r.userId,
    displayName: r.displayName,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    pointsGlobal: r.pointsGlobal,
    pointsResult: derivePointsResult(r.pointsGlobal, r.scorerBonusPoints),
    scorerPickPlayerId: r.scorerPickPlayerId,
    scorerPlayerNameSnapshot: r.scorerPlayerNameSnapshot,
    scorerBonusPoints: r.scorerBonusPoints,
    isSupporter: r.supporterAt !== null,
  }))

  if (groupId === undefined) return baseRows

  const memberRows = await db
    .select({ userId: groupMembers.userId, paidAt: groupMembers.paidAt })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId))
  const paidByUser = new Map(memberRows.map(m => [m.userId, m.paidAt !== null]))
  return baseRows.map(r => ({ ...r, isPaid: paidByUser.get(r.userId) ?? false }))
}
