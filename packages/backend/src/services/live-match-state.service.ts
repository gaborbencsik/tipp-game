import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { liveMatchStates, matchResults } from '../db/schema/index.js'
import { eventBus } from './event-bus.service.js'

export interface LiveStateInput {
  readonly matchId: string
  readonly homeScore: number
  readonly awayScore: number
  readonly minute?: number | null
  readonly apiStatus?: string | null
}

export interface LiveState {
  readonly matchId: string
  readonly homeScore: number
  readonly awayScore: number
  readonly minute: number | null
  readonly apiStatus: string | null
  readonly updatedAt: Date
}

export interface FinalizeInput {
  readonly matchId: string
  readonly homeGoals: number
  readonly awayGoals: number
  readonly extraTimeHomeGoals?: number | null
  readonly extraTimeAwayGoals?: number | null
  readonly outcomeAfterDraw?: string | null
  readonly recordedBy?: string | null
}

export async function upsertLiveState(input: LiveStateInput): Promise<void> {
  await db.insert(liveMatchStates).values({
    matchId: input.matchId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    minute: input.minute ?? null,
    apiStatus: input.apiStatus ?? null,
  }).onConflictDoUpdate({
    target: liveMatchStates.matchId,
    set: {
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      minute: input.minute ?? null,
      apiStatus: input.apiStatus ?? null,
      updatedAt: new Date(),
    },
  })

  eventBus.emit('match.update', {
    matchId: input.matchId,
    status: 'live',
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    updatedAt: new Date().toISOString(),
  })
}

export async function getLiveStateByMatchId(matchId: string): Promise<LiveState | null> {
  const rows = await db.select().from(liveMatchStates).where(eq(liveMatchStates.matchId, matchId))
  const row = rows[0]
  return row ? (row as LiveState) : null
}

export async function deleteLiveState(matchId: string): Promise<void> {
  await db.delete(liveMatchStates).where(eq(liveMatchStates.matchId, matchId))
}

export interface FinalizeResult {
  readonly wasInserted: boolean
  readonly scoreChanged: boolean
}

export async function finalizeLiveToResult(input: FinalizeInput): Promise<FinalizeResult> {
  const result = await db.transaction(async (tx) => {
    await tx.delete(liveMatchStates).where(eq(liveMatchStates.matchId, input.matchId))

    const existingRows = await tx
      .select({
        homeGoals: matchResults.homeGoals,
        awayGoals: matchResults.awayGoals,
        extraTimeHomeGoals: matchResults.extraTimeHomeGoals,
        extraTimeAwayGoals: matchResults.extraTimeAwayGoals,
        outcomeAfterDraw: matchResults.outcomeAfterDraw,
      })
      .from(matchResults)
      .where(eq(matchResults.matchId, input.matchId))
      .limit(1)

    const existing = existingRows[0]
    const wasInserted = !existing
    const newOutcome = input.outcomeAfterDraw ?? null
    const newEtHome = input.extraTimeHomeGoals ?? null
    const newEtAway = input.extraTimeAwayGoals ?? null
    const scoreChanged = !!existing && (
      existing.homeGoals !== input.homeGoals ||
      existing.awayGoals !== input.awayGoals ||
      (existing.extraTimeHomeGoals ?? null) !== newEtHome ||
      (existing.extraTimeAwayGoals ?? null) !== newEtAway ||
      (existing.outcomeAfterDraw ?? null) !== newOutcome
    )

    await tx.insert(matchResults).values({
      matchId: input.matchId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      extraTimeHomeGoals: newEtHome,
      extraTimeAwayGoals: newEtAway,
      outcomeAfterDraw: newOutcome,
      recordedBy: input.recordedBy ?? null,
    }).onConflictDoUpdate({
      target: matchResults.matchId,
      set: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        extraTimeHomeGoals: newEtHome,
        extraTimeAwayGoals: newEtAway,
        outcomeAfterDraw: newOutcome,
        updatedAt: new Date(),
      },
    })

    return { wasInserted, scoreChanged }
  })

  eventBus.emit('match.update', {
    matchId: input.matchId,
    status: 'finished',
    homeScore: input.homeGoals,
    awayScore: input.awayGoals,
    updatedAt: new Date().toISOString(),
  })

  return result
}
