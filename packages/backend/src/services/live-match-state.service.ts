import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { liveMatchStates, matchResults } from '../db/schema/index.js'

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
}

export async function getLiveStateByMatchId(matchId: string): Promise<LiveState | null> {
  const rows = await db.select().from(liveMatchStates).where(eq(liveMatchStates.matchId, matchId))
  const row = rows[0]
  return row ? (row as LiveState) : null
}

export async function deleteLiveState(matchId: string): Promise<void> {
  await db.delete(liveMatchStates).where(eq(liveMatchStates.matchId, matchId))
}

export async function finalizeLiveToResult(input: FinalizeInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(liveMatchStates).where(eq(liveMatchStates.matchId, input.matchId))
    await tx.insert(matchResults).values({
      matchId: input.matchId,
      homeGoals: input.homeGoals,
      awayGoals: input.awayGoals,
      outcomeAfterDraw: input.outcomeAfterDraw ?? null,
      recordedBy: input.recordedBy ?? null,
    }).onConflictDoUpdate({
      target: matchResults.matchId,
      set: {
        homeGoals: input.homeGoals,
        awayGoals: input.awayGoals,
        outcomeAfterDraw: input.outcomeAfterDraw ?? null,
        updatedAt: new Date(),
      },
    })
  })
}
