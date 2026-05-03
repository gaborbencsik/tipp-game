import { sql, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { teams, matches, matchResults, venues, auditLogs } from '../db/schema/index.js'
import type {
  ApiFootballFixture,
  ApiFootballTeam,
  SyncMode,
  SyncRunResult,
  MatchStage,
  MatchStatus,
} from '../types/index.js'
import type { FootballApiClient } from './football-api.service.js'

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

export function derivePenaltyOutcome(penalty: PenaltyScore): string | null {
  if (penalty.home === null || penalty.away === null) {
    return null
  }
  if (penalty.home === penalty.away) {
    return null
  }
  return penalty.home > penalty.away ? 'penalties_home' : 'penalties_away'
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
      .select({ id: teams.id, externalId: teams.externalId })
      .from(teams)
      .where(eq(teams.shortCode, baseCode))
      .limit(1)

    if (existing && existing.externalId === null) {
      // Manually-created team without external link — claim it
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
    const venueCity = fixture.fixture.venue.city
    if (venueName && venueCity) {
      const [existingVenue] = await db
        .select({ id: venues.id })
        .from(venues)
        .where(eq(venues.name, venueName))
        .limit(1)

      if (existingVenue) {
        venueId = existingVenue.id
      } else {
        const [newVenue] = await db.insert(venues).values({
          id: crypto.randomUUID(),
          name: venueName,
          city: venueCity,
          country: '',
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
  apiFixtures: readonly ApiFootballFixture[]
): Promise<number> {
  let count = 0

  for (const fixture of apiFixtures) {
    const status = FIXTURE_STATUS_MAP[fixture.fixture.status.short]
    if (status !== 'finished') {
      continue
    }

    const homeGoals = fixture.goals.home
    const awayGoals = fixture.goals.away
    if (homeGoals === null || awayGoals === null) {
      continue
    }

    const [match] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.externalId, fixture.fixture.id))
      .limit(1)

    if (!match) {
      continue
    }

    const outcomeAfterDraw = derivePenaltyOutcome(fixture.score.penalty)

    await db.insert(matchResults).values({
      id: crypto.randomUUID(),
      matchId: match.id,
      homeGoals,
      awayGoals,
      outcomeAfterDraw,
      recordedBy: null,
    }).onConflictDoUpdate({
      target: matchResults.matchId,
      set: {
        homeGoals: sql`excluded.home_goals`,
        awayGoals: sql`excluded.away_goals`,
        outcomeAfterDraw: sql`excluded.outcome_after_draw`,
        updatedAt: sql`now()`,
      },
    })
    count++
  }

  return count
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────

export async function runSync(
  leagueExternalId: number,
  leagueInternalId: string,
  season: number,
  client: FootballApiClient,
  mode: SyncMode
): Promise<SyncRunResult> {
  const startedAt = new Date().toISOString()
  const errors: string[] = []

  let teamsUpserted = 0
  let fixturesUpserted = 0
  let resultsUpserted = 0

  // Step 1: Fetch and upsert teams
  try {
    const teamsResponse = await client.fetchTeams({ league: leagueExternalId, season })
    teamsUpserted = await upsertTeams(teamsResponse.response, leagueInternalId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching teams'
    errors.push(`teams: ${message}`)
  }

  // Step 2: Fetch and upsert fixtures + results
  try {
    const fixturesResponse = await client.fetchFixtures({ league: leagueExternalId, season })
    fixturesUpserted = await upsertFixtures(fixturesResponse.response, leagueInternalId)

    try {
      resultsUpserted = await upsertResults(fixturesResponse.response)
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
