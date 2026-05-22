import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { insightReveals, matches } from '../../db/schema/index.js'

export class MatchNotFoundError extends Error {
  constructor(matchId: string) {
    super(`Match not found: ${matchId}`)
    this.name = 'MatchNotFoundError'
  }
}

export interface RevealResult {
  readonly revealed: true
}

export async function revealInsight(userId: string, matchId: string): Promise<RevealResult> {
  const matchRows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)
  if (matchRows.length === 0) throw new MatchNotFoundError(matchId)

  await db
    .insert(insightReveals)
    .values({ userId, matchId })
    .onConflictDoNothing({ target: [insightReveals.userId, insightReveals.matchId] })
    .returning()

  return { revealed: true }
}

export async function isMatchRevealed(userId: string, matchId: string): Promise<boolean> {
  const rows = await db
    .select({ id: insightReveals.id })
    .from(insightReveals)
    .where(and(eq(insightReveals.userId, userId), eq(insightReveals.matchId, matchId)))
    .limit(1)
  return rows.length > 0
}
