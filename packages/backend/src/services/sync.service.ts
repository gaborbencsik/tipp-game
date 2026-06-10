import { sql, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { teams, matches, matchResults, venues, players, auditLogs } from '../db/schema/index.js'
import { calculateAndSavePoints, calculateAndSaveGroupPoints } from './scoring.service.js'
import { upsertLiveState, deleteLiveState, finalizeLiveToResult } from './live-match-state.service.js'
import { createLogger } from './logger.service.js'
import type {
  ApiFootballFixture,
  ApiFootballTeam,
  ApiFootballFixtureEvent,
  SyncMode,
  SyncRunResult,
  MatchStage,
  MatchStatus,
  MatchOutcome,
} from '../types/index.js'
import type { FootballApiClient } from './football-api.service.js'
import { lookupVenueImage, normalizeVenueName } from './venue-images.js'

const log = createLogger('sync.service')

// ─── PURE HELPERS ────────────────────────────────────────────────────────────

interface ParsedRound {
  readonly stage: MatchStage
  readonly groupName: string | null
}

const KNOCKOUT_MAP: ReadonlyMap<string, MatchStage> = new Map([
  ['Round of 16', 'round_of_16'],
  ['Quarter-finals', 'quarter_final'],
  ['Semi-finals', 'semi_final'],
  ['3rd Place Final', 'third_place'],
  ['Final', 'final'],
])

export function parseRound(round: string): ParsedRound {
  // Exact knockout match
  const knockoutStage = KNOCKOUT_MAP.get(round)
  if (knockoutStage) {
    return { stage: knockoutStage, groupName: null }
  }

  // "Group X - N" pattern (e.g., "Group A - 1")
  const groupMatch = /^Group ([A-H]) - \d+$/.exec(round)
  if (groupMatch) {
    return { stage: 'group', groupName: groupMatch[1] }
  }

  // "Group Stage - N" pattern — store the full round string
  if (round.startsWith('Group Stage')) {
    return { stage: 'group', groupName: round }
  }

  // Fallback (Regular Season, unknown, empty)
  return { stage: 'group', groupName: null }
}

export const FIXTURE_STATUS_MAP: Readonly<Record<string, string>> = {
  NS: 'scheduled',
  '1H': 'live',
  HT: 'live',
  '2H': 'live',
  ET: 'live',
  P: 'live',
  LIVE: 'live',
  BT: 'live',
  FT: 'finished',
  AET: 'finished',
  PEN: 'finished',
  CANC: 'cancelled',
  SUSP: 'cancelled',
  ABD: 'cancelled',
  AWD: 'cancelled',
  WO: 'cancelled',
}

interface PenaltyScore {
  readonly home: number | null
  readonly away: number | null
}

export function derivePenaltyOutcome(penalty: PenaltyScore): MatchOutcome | null {
  if (penalty.home === null || penalty.away === null) {
    return null
  }
  if (penalty.home === penalty.away) {
    return null
  }
  return penalty.home > penalty.away ? 'penalties_home' : 'penalties_away'
}

export function filterFixturesByAllowlist(
  fixtures: readonly ApiFootballFixture[],
  allowlist: readonly number[]
): readonly ApiFootballFixture[] {
  const set = new Set(allowlist)
  return fixtures.filter((f) => set.has(f.fixture.id))
}

export function teamsFromFixtures(
  fixtures: readonly ApiFootballFixture[]
): readonly ApiFootballTeam[] {
  const teamMap = new Map<number, ApiFootballTeam>()
  for (const fixture of fixtures) {
    teamMap.set(fixture.teams.home.id, { team: fixture.teams.home, venue: null })
    teamMap.set(fixture.teams.away.id, { team: fixture.teams.away, venue: null })
  }
  return [...teamMap.values()]
}

/**
 * Pure helper: filters api-football /fixtures/events output down to a deduplicated
 * array of internal player UUIDs who legitimately scored in regulation/extra time.
 *
 * Filter rules (validated 2026-06-08 on ARG–FRA WC2022 final and NED–ARG QF):
 *   1. type === 'Goal'
 *   2. detail !== 'Missed Penalty'
 *   3. detail !== 'Own Goal'
 *   4. comments !== 'Penalty Shootout'   ← single-source-of-truth for shootouts
 *
 * VAR-cancelled goals: a 'Var' event with detail === 'Goal cancelled' on the same
 * (elapsed, extra, player.id) key removes the corresponding goal.
 *
 * Unknown player.id (not in playerIdMap), null player.id, and null elapsed are dropped.
 */
export function mapEventsToScorerPlayerIds(
  events: readonly ApiFootballFixtureEvent[],
  playerIdMap: ReadonlyMap<number, string>,
): readonly string[] {
  const cancelledKeys = new Set<string>()
  for (const e of events) {
    if (e.type === 'Var' && e.detail === 'Goal cancelled' && e.player.id !== null && e.time.elapsed !== null) {
      cancelledKeys.add(`${e.time.elapsed}|${e.time.extra ?? ''}|${e.player.id}`)
    }
  }

  const scorerIds = new Set<string>()
  for (const e of events) {
    if (e.type !== 'Goal') continue
    if (e.detail === 'Missed Penalty') continue
    if (e.detail === 'Own Goal') continue
    if (e.comments === 'Penalty Shootout') continue
    if (e.player.id === null) continue
    if (e.time.elapsed === null) continue

    const key = `${e.time.elapsed}|${e.time.extra ?? ''}|${e.player.id}`
    if (cancelledKeys.has(key)) continue

    const internalId = playerIdMap.get(e.player.id)
    if (!internalId) continue
    scorerIds.add(internalId)
  }
  return [...scorerIds]
}

// ─── DB FUNCTIONS ────────────────────────────────────────────────────────────

export async function upsertTeams(
  apiTeams: readonly ApiFootballTeam[],
  leagueInternalId: string
): Promise<number> {
  let count = 0

  for (const entry of apiTeams) {
    const { team } = entry
    const baseCode = team.code ?? team.name.slice(0, 3).toUpperCase()

    // Check if this team already exists by external_id (update path)
    const [byExternal] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.externalId, team.id))
      .limit(1)

    if (byExternal) {
      await db.update(teams)
        .set({
          name: team.name,
          flagUrl: team.logo,
          teamType: team.national ? 'national' : 'club',
          updatedAt: sql`now()`,
        })
        .where(eq(teams.id, byExternal.id))
      count++
      continue
    }

    // Check if short_code is taken — link or deduplicate
    const [existing] = await db
      .select({ id: teams.id, name: teams.name, externalId: teams.externalId })
      .from(teams)
      .where(eq(teams.shortCode, baseCode))
      .limit(1)

    if (existing && existing.externalId === null) {
      const nameMatches = existing.name.toLowerCase() === team.name.toLowerCase()
      if (nameMatches) {
        // Short code AND name match — safe to claim
        await db.update(teams)
          .set({
            externalId: team.id,
            name: team.name,
            flagUrl: team.logo,
            teamType: team.national ? 'national' : 'club',
            updatedAt: sql`now()`,
          })
          .where(eq(teams.id, existing.id))
        count++
        continue
      }
    }

    // Try name-based fallback (case-insensitive) when short_code didn't match
    const [byName] = await db
      .select({ id: teams.id, externalId: teams.externalId })
      .from(teams)
      .where(sql`lower(${teams.name}) = ${team.name.toLowerCase()}`)
      .limit(1)

    if (byName && byName.externalId === null) {
      await db.update(teams)
        .set({
          externalId: team.id,
          flagUrl: team.logo,
          teamType: team.national ? 'national' : 'club',
          updatedAt: sql`now()`,
        })
        .where(eq(teams.id, byName.id))
      count++
      continue
    }

    // short_code conflict with different team — use a deduplicated code
    const shortCode = existing
      ? baseCode.slice(0, 3) + String(team.id).slice(-1)
      : baseCode

    await db.insert(teams).values({
      id: crypto.randomUUID(),
      externalId: team.id,
      name: team.name,
      shortCode,
      flagUrl: team.logo,
      teamType: team.national ? 'national' : 'club',
    })
    count++
  }

  return count
}

export async function upsertFixtures(
  apiFixtures: readonly ApiFootballFixture[],
  leagueInternalId: string
): Promise<number> {
  let count = 0

  for (const fixture of apiFixtures) {
    const { stage, groupName } = parseRound(fixture.league.round)
    const status = (FIXTURE_STATUS_MAP[fixture.fixture.status.short] ?? 'scheduled') as MatchStatus

    // Look up home and away teams by externalId
    const [homeTeam] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.externalId, fixture.teams.home.id))
      .limit(1)

    const [awayTeam] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.externalId, fixture.teams.away.id))
      .limit(1)

    if (!homeTeam || !awayTeam) {
      continue
    }

    // Look up or create venue
    let venueId: string | null = null
    const venueName = fixture.fixture.venue.name
    const venueCity = fixture.fixture.venue.city ?? ''
    if (venueName) {
      const normalizedName = normalizeVenueName(venueName)
      const [existingVenue] = await db
        .select({ id: venues.id })
        .from(venues)
        .where(sql`TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER(${venues.name}), '[''‘’]', '', 'g'), '\\s+', ' ', 'g')) = ${normalizedName}`)
        .limit(1)

      if (existingVenue) {
        venueId = existingVenue.id
      } else {
        const [newVenue] = await db.insert(venues).values({
          id: crypto.randomUUID(),
          name: venueName,
          city: venueCity,
          country: '',
          imageUrl: lookupVenueImage(venueName),
        }).returning({ id: venues.id })
        venueId = newVenue?.id ?? null
      }
    }

    await db.insert(matches).values({
      id: crypto.randomUUID(),
      externalId: fixture.fixture.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      venueId,
      leagueId: leagueInternalId,
      stage,
      groupName,
      scheduledAt: new Date(fixture.fixture.date),
      status,
    }).onConflictDoUpdate({
      target: matches.externalId,
      set: {
        scheduledAt: sql`excluded.scheduled_at`,
        status: sql`excluded.status`,
        venueId: sql`excluded.venue_id`,
        homeTeamId: sql`excluded.home_team_id`,
        awayTeamId: sql`excluded.away_team_id`,
        stage: sql`excluded.stage`,
        groupName: sql`excluded.group_name`,
        updatedAt: sql`now()`,
      },
    })
    count++
  }

  return count
}

export async function upsertResults(
  apiFixtures: readonly ApiFootballFixture[],
  client?: FootballApiClient,
): Promise<number> {
  let count = 0

  for (const fixture of apiFixtures) {
    const status = FIXTURE_STATUS_MAP[fixture.fixture.status.short]
    if (status !== 'finished' && status !== 'live' && status !== 'cancelled') {
      continue
    }

    const homeGoals = fixture.goals.home
    const awayGoals = fixture.goals.away

    const [match] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.externalId, fixture.fixture.id))
      .limit(1)

    if (!match) {
      continue
    }

    if (status === 'cancelled') {
      await deleteLiveState(match.id)
      continue
    }

    if (status === 'live') {
      if (homeGoals === null || awayGoals === null) continue
      await upsertLiveState({
        matchId: match.id,
        homeScore: homeGoals,
        awayScore: awayGoals,
        minute: fixture.fixture.status.elapsed,
        apiStatus: fixture.fixture.status.short,
      })
      continue
    }

    if (homeGoals === null || awayGoals === null) {
      continue
    }

    const outcomeAfterDraw = derivePenaltyOutcome(fixture.score.penalty)

    const finalizeResult = await finalizeLiveToResult({
      matchId: match.id,
      homeGoals,
      awayGoals,
      outcomeAfterDraw,
    })

    if (finalizeResult.wasInserted || finalizeResult.scoreChanged) {
      if (client) {
        await syncScorerPlayerIds({ matchId: match.id, externalFixtureId: fixture.fixture.id, client })
      }
      await calculateAndSavePoints(match.id, { homeGoals, awayGoals, outcomeAfterDraw: outcomeAfterDraw ?? null })
      await calculateAndSaveGroupPoints(match.id, { homeGoals, awayGoals, outcomeAfterDraw: outcomeAfterDraw ?? null })
      await db
        .update(matchResults)
        .set({ pointsCalculatedAt: new Date() })
        .where(eq(matchResults.matchId, match.id))
    }

    count++
  }

  return count
}

// ─── SCORER AUTO-SYNC ────────────────────────────────────────────────────────

async function loadPlayerIdMap(externalIds: readonly number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  if (externalIds.length === 0) return map
  const rows = await db
    .select({ id: players.id, externalId: players.externalId })
    .from(players)
    .where(inArray(players.externalId, externalIds as number[]))
  for (const row of rows) {
    if (row.externalId !== null) map.set(row.externalId, row.id)
  }
  return map
}

interface SyncScorerOpts {
  readonly matchId: string
  readonly externalFixtureId: number
  readonly client: FootballApiClient
}

/**
 * Fetches /fixtures/events for a finalized match, maps the goal events to internal
 * player UUIDs, and overwrites match_results.scorer_player_ids.
 *
 * Failure-tolerant: any error here is logged and swallowed so the surrounding
 * upsertResults pipeline (calculateAndSavePoints) still runs. The admin UI
 * (SCORER-003) remains the manual fallback.
 */
export async function syncScorerPlayerIds(opts: SyncScorerOpts): Promise<void> {
  const { matchId, externalFixtureId, client } = opts
  try {
    const eventsResponse = await client.fetchFixtureEvents({ fixtureId: externalFixtureId })
    const goalEvents = eventsResponse.response.filter((e) => e.type === 'Goal')
    const externalPlayerIds = goalEvents
      .map((e) => e.player.id)
      .filter((id): id is number => id !== null)
    const playerIdMap = await loadPlayerIdMap(externalPlayerIds)

    const known = new Set(playerIdMap.keys())
    for (const e of goalEvents) {
      if (e.player.id !== null && !known.has(e.player.id)) {
        log.warn('scorer_sync_unknown_player', {
          matchId,
          externalFixtureId,
          externalPlayerId: e.player.id,
          playerName: e.player.name,
        })
      }
    }

    const scorerPlayerIds = mapEventsToScorerPlayerIds(eventsResponse.response, playerIdMap)
    await db
      .update(matchResults)
      .set({ scorerPlayerIds: [...scorerPlayerIds] })
      .where(eq(matchResults.matchId, matchId))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.warn('scorer_sync_failed', { matchId, externalFixtureId, error: message })
  }
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────

export interface RunSyncOptions {
  readonly leagueExternalId: number
  readonly leagueInternalId: string
  readonly season: number
  readonly client: FootballApiClient
  readonly mode: SyncMode
  readonly dateRange?: { from?: string; to?: string }
  readonly fixtureAllowlist?: readonly number[]
}

export async function runSync(opts: RunSyncOptions): Promise<SyncRunResult> {
  const {
    leagueExternalId,
    leagueInternalId,
    season,
    client,
    mode,
    dateRange,
    fixtureAllowlist,
  } = opts
  const startedAt = new Date().toISOString()
  const errors: string[] = []

  let teamsUpserted = 0
  let fixturesUpserted = 0
  let resultsUpserted = 0

  const hasAllowlist = fixtureAllowlist !== undefined && fixtureAllowlist.length > 0

  // Step 1: When no allowlist filter is in play, fetch the full league team roster.
  // Otherwise teams are derived from the filtered fixtures (no extra API call needed).
  if (!hasAllowlist) {
    try {
      const teamsResponse = await client.fetchTeams({ league: leagueExternalId, season })
      teamsUpserted = await upsertTeams(teamsResponse.response, leagueInternalId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching teams'
      errors.push(`teams: ${message}`)
    }
  }

  // Step 2: Fetch fixtures, optionally filter by allowlist, then upsert teams (when filtered) + fixtures + results
  try {
    const fixturesResponse = await client.fetchFixtures({
      league: leagueExternalId,
      season,
      ...(dateRange?.from ? { from: dateRange.from } : {}),
      ...(dateRange?.to ? { to: dateRange.to } : {}),
    })

    let filteredFixtures = fixturesResponse.response as readonly ApiFootballFixture[]
    if (hasAllowlist) {
      filteredFixtures = filterFixturesByAllowlist(filteredFixtures, fixtureAllowlist)
    }

    if (hasAllowlist) {
      try {
        teamsUpserted = await upsertTeams(teamsFromFixtures(filteredFixtures), leagueInternalId)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error upserting teams from filtered fixtures'
        errors.push(`teams: ${message}`)
      }
    }

    fixturesUpserted = await upsertFixtures(filteredFixtures, leagueInternalId)

    try {
      resultsUpserted = await upsertResults(filteredFixtures, client)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error upserting results'
      errors.push(`results: ${message}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching fixtures'
    errors.push(`fixtures: ${message}`)
  }

  const finishedAt = new Date().toISOString()

  // Write audit log
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorId: null,
      action: 'update',
      entityType: 'sync_run',
      entityId: leagueInternalId,
      previousValue: null,
      newValue: {
        mode,
        leagueExternalId,
        season,
        teamsUpserted,
        fixturesUpserted,
        resultsUpserted,
        errors,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error writing audit log'
    errors.push(`audit: ${message}`)
  }

  return {
    startedAt,
    finishedAt,
    mode,
    leaguesSynced: 1,
    fixturesUpserted,
    teamsUpserted,
    resultsUpserted,
    errors,
    partial: errors.length > 0,
  }
}
