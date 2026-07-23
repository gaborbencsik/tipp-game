import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { groups, groupMembers, groupLeagues, groupMatches, groupPredictionPoints, matches, matchResults, predictions, auditLogs } from '../db/schema/index.js'
import { calculateAndSaveGroupPoints } from './scoring.service.js'
import { getMatches } from './matches.service.js'
import type { ResultScore } from './scoring.service.js'
import type { MatchOutcome, Match } from '../types/index.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

async function assertGroupAdmin(groupId: string, userId: string): Promise<void> {
  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  if (!groupRows[0]) throw new AppError(404, 'Group not found')

  const memberRows = await db
    .select({ isAdmin: groupMembers.isAdmin })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1)
  if (!memberRows[0]?.isAdmin) throw new AppError(403, 'Not authorized')
}

/**
 * The effective match set of a group: league-based matches ∪ hand-picked
 * matches, de-duplicated. Central helper used by every projection so the union
 * logic lives in exactly one place.
 */
export async function getGroupEffectiveMatchIds(groupId: string): Promise<string[]> {
  const leagueRows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  const leagueIds = leagueRows.map((r) => r.leagueId)

  const handPickedRows = await db
    .select({ matchId: groupMatches.matchId })
    .from(groupMatches)
    .where(eq(groupMatches.groupId, groupId))

  const ids = new Set<string>(handPickedRows.map((r) => r.matchId))

  if (leagueIds.length > 0) {
    const leagueMatchRows = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(inArray(matches.leagueId, leagueIds), isNull(matches.deletedAt)))
    for (const row of leagueMatchRows) ids.add(row.id)
  }

  return [...ids]
}

/**
 * The group's effective match list (league-based ∪ hand-picked), each match
 * flagged with `handPicked` so the UI can distinguish manually pulled-in
 * matches. Archived-league matches follow getMatches' default hiding.
 */
export async function getGroupEffectiveMatches(groupId: string): Promise<Match[]> {
  const leagueRows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  const leagueIds = leagueRows.map((r) => r.leagueId)

  const handPickedRows = await db
    .select({ matchId: groupMatches.matchId, addedAt: groupMatches.addedAt })
    .from(groupMatches)
    .where(eq(groupMatches.groupId, groupId))
  const handPickedIds = new Set(handPickedRows.map((r) => r.matchId))
  const addedAtById = new Map(handPickedRows.map((r) => [r.matchId, r.addedAt]))

  const leagueMatches = leagueIds.length > 0
    ? await getMatches({ leagueIds })
    : []

  // Hand-picked matches may live in ANY league (including ones not subscribed),
  // so fetch them explicitly and allow archived leagues here — the admin chose them.
  const handPickedMatches = handPickedIds.size > 0
    ? (await getMatches({ includeArchivedLeagues: true })).filter((m) => handPickedIds.has(m.id))
    : []

  const byId = new Map<string, Match>()
  for (const m of leagueMatches) byId.set(m.id, { ...m, handPicked: handPickedIds.has(m.id) })
  for (const m of handPickedMatches) byId.set(m.id, { ...m, handPicked: true })

  // Hand-picked matches surface most-recently-added first (addedAt DESC) so the
  // group settings list shows the latest pick on top; league-only matches keep
  // their natural chronological order below them.
  return [...byId.values()].sort((a, b) => {
    const aAdded = addedAtById.get(a.id)
    const bAdded = addedAtById.get(b.id)
    if (aAdded && bAdded) return bAdded.getTime() - aAdded.getTime()
    if (aAdded) return -1
    if (bAdded) return 1
    return a.scheduledAt.localeCompare(b.scheduledAt)
  })
}

export async function addGroupMatch(groupId: string, matchId: string, actorId: string): Promise<void> {
  await assertGroupAdmin(groupId, actorId)

  const matchRows = await db
    .select({ id: matches.id, status: matches.status })
    .from(matches)
    .where(and(eq(matches.id, matchId), isNull(matches.deletedAt)))
    .limit(1)
  const match = matchRows[0]
  if (!match) throw new AppError(404, 'Match not found')

  const existing = await db
    .select({ id: groupMatches.id })
    .from(groupMatches)
    .where(and(eq(groupMatches.groupId, groupId), eq(groupMatches.matchId, matchId)))
    .limit(1)
  if (existing.length > 0) return

  await db.insert(groupMatches).values({ groupId, matchId, addedBy: actorId })

  await db.insert(auditLogs).values({
    actorId,
    action: 'group_match_add',
    entityType: 'group_match',
    entityId: matchId,
    previousValue: null,
    newValue: { groupId, matchId },
  })

  // If the match is already finished with a recorded result, (re)calculate the
  // group points for the pulled-in match so existing tips count immediately.
  if (match.status === 'finished') {
    const resultRows = await db
      .select({
        homeGoals: matchResults.homeGoals,
        awayGoals: matchResults.awayGoals,
        outcomeAfterDraw: matchResults.outcomeAfterDraw,
      })
      .from(matchResults)
      .where(eq(matchResults.matchId, matchId))
      .limit(1)
    const r = resultRows[0]
    if (r) {
      const result: ResultScore = {
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        outcomeAfterDraw: (r.outcomeAfterDraw ?? null) as MatchOutcome | null,
      }
      await calculateAndSaveGroupPoints(matchId, result)
    }
  }
}

export async function removeGroupMatch(groupId: string, matchId: string, actorId: string): Promise<void> {
  await assertGroupAdmin(groupId, actorId)

  const existing = await db
    .select({ id: groupMatches.id })
    .from(groupMatches)
    .where(and(eq(groupMatches.groupId, groupId), eq(groupMatches.matchId, matchId)))
    .limit(1)
  if (existing.length === 0) return

  await db
    .delete(groupMatches)
    .where(and(eq(groupMatches.groupId, groupId), eq(groupMatches.matchId, matchId)))

  // Remove the group points for this match ONLY when the match is no longer part
  // of the group's effective set (i.e. it is outside the subscribed leagues).
  // If a subscribed league still covers it, the match stays in scope and its
  // points must be preserved.
  const matchRows = await db
    .select({ leagueId: matches.leagueId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)
  const matchLeagueId = matchRows[0]?.leagueId ?? null

  const leagueRows = await db
    .select({ leagueId: groupLeagues.leagueId })
    .from(groupLeagues)
    .where(eq(groupLeagues.groupId, groupId))
  const stillCovered = matchLeagueId !== null && leagueRows.some((r) => r.leagueId === matchLeagueId)

  if (!stillCovered) {
    const predRows = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(eq(predictions.matchId, matchId))
    const predIds = predRows.map((p) => p.id)
    if (predIds.length > 0) {
      await db
        .delete(groupPredictionPoints)
        .where(and(eq(groupPredictionPoints.groupId, groupId), inArray(groupPredictionPoints.predictionId, predIds)))
    }
  }

  await db.insert(auditLogs).values({
    actorId,
    action: 'group_match_remove',
    entityType: 'group_match',
    entityId: matchId,
    previousValue: { groupId, matchId },
    newValue: null,
  })
}
