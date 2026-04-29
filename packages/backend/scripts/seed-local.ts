import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import {
  scoringConfigs, teams, users, venues,
  matches, matchResults, predictions,
  groups, groupMembers, leagues,
  players, specialPredictionTypes, specialPredictions,
  groupGlobalTypeSubscriptions, groupPredictionPoints,
  waitlistEntries, auditLogs, userLeagueFavorites,
} from '../src/db/schema/index.js'

// ─── Fixed UUIDs ─────────────────────────────────────────────────────────────

const ADMIN_USER_ID   = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01'
const USER_PETER_ID   = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02'
const USER_ANNA_ID    = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03'
const USER_BELA_ID    = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee04'
const USER_KATA_ID    = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee05'
const USER_MATE_ID    = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee06'

const VENUE_METLIFE_ID = 'cccccccc-1111-2222-3333-aaaaaaaaaaaa'
const VENUE_AZTECA_ID  = 'cccccccc-1111-2222-3333-bbbbbbbbbbbb'
const VENUE_ATT_ID     = 'cccccccc-1111-2222-3333-cccccccccccc'

const MATCH_1_ID  = 'dddddddd-1111-2222-3333-000000000001'
const MATCH_2_ID  = 'dddddddd-1111-2222-3333-000000000002'
const MATCH_3_ID  = 'dddddddd-1111-2222-3333-000000000003'
const MATCH_4_ID  = 'dddddddd-1111-2222-3333-000000000004'
const MATCH_5_ID  = 'dddddddd-1111-2222-3333-000000000005'
const MATCH_6_ID  = 'dddddddd-1111-2222-3333-000000000006'
const MATCH_7_ID  = 'dddddddd-1111-2222-3333-000000000007'
const MATCH_8_ID  = 'dddddddd-1111-2222-3333-000000000008'
const MATCH_9_ID  = 'dddddddd-1111-2222-3333-000000000009'
const MATCH_10_ID = 'dddddddd-1111-2222-3333-000000000010'

const RESULT_1_ID = 'eeeeeeee-1111-2222-3333-000000000001'
const RESULT_2_ID = 'eeeeeeee-1111-2222-3333-000000000002'
const RESULT_3_ID = 'eeeeeeee-1111-2222-3333-000000000003'
const RESULT_4_ID = 'eeeeeeee-1111-2222-3333-000000000004'

const GROUP_IRODA_ID   = 'ffffffff-1111-2222-3333-000000000001'
const GROUP_HAVEROK_ID = 'ffffffff-1111-2222-3333-000000000002'

const LEAGUE_WC_ID = 'bbbbbbbb-1111-2222-3333-000000000001'

const PLAYER_MESSI_ID    = '11111111-aaaa-bbbb-cccc-000000000001'
const PLAYER_ALVAREZ_ID  = '11111111-aaaa-bbbb-cccc-000000000002'
const PLAYER_VINICIUS_ID = '11111111-aaaa-bbbb-cccc-000000000003'
const PLAYER_MUSIALA_ID  = '11111111-aaaa-bbbb-cccc-000000000004'

const SPT_GOLKIRALY_ID      = '22222222-aaaa-bbbb-cccc-000000000001'
const SPT_WINNER_ID         = '22222222-aaaa-bbbb-cccc-000000000002'
const SPT_CSOPORTGYOZTES_ID = '22222222-aaaa-bbbb-cccc-000000000003'

// ─── Helper: resolve team ID by shortCode ───────────────────────────────────

async function teamId(shortCode: string): Promise<string> {
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.shortCode, shortCode))
    .limit(1)
  const row = rows[0]
  if (!row) throw new Error(`Team not found: ${shortCode}`)
  return row.id
}

// ─── Helper: manual scoring calculation ─────────────────────────────────────

function calcPoints(
  predHome: number, predAway: number,
  resHome: number, resAway: number,
): number {
  const predDiff = predHome - predAway
  const resDiff = resHome - resAway

  if (predHome === resHome && predAway === resAway) return 3
  const predW = Math.sign(predDiff)
  const resW = Math.sign(resDiff)
  if (predW === 0 && resW === 0) return 2
  if (predW === resW) {
    if (predDiff === resDiff) return 2
    return 1
  }
  return 0
}

async function seedLocal(): Promise<void> {
  console.log('Seeding local dev data...')

  // ─── Clean slate: delete in FK-safe order ────────────────────────────────
  console.log('  Cleaning previous dev data...')
  await db.delete(auditLogs)
  await db.delete(waitlistEntries)
  await db.delete(groupGlobalTypeSubscriptions)
  await db.delete(specialPredictions)
  await db.delete(specialPredictionTypes)
  await db.delete(groupPredictionPoints)
  await db.delete(groupMembers)
  await db.delete(groups)
  await db.delete(predictions)
  await db.delete(matchResults)
  await db.delete(matches)
  await db.delete(players)
  await db.delete(userLeagueFavorites)
  await db.delete(leagues)
  await db.delete(users)
  await db.delete(venues)

  // ─── Venues ────────────────────────────────────────────────────────────────
  const venueData = [
    { id: VENUE_METLIFE_ID, name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA', capacity: 82500 },
    { id: VENUE_AZTECA_ID, name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', capacity: 87523 },
    { id: VENUE_ATT_ID, name: 'AT&T Stadium', city: 'Arlington', country: 'USA', capacity: 80000 },
    { name: 'SoFi Stadium', city: 'Inglewood', country: 'USA', capacity: 70240 },
    { name: 'Estadio AKRON', city: 'Guadalajara', country: 'Mexico', capacity: 49850 },
    { name: 'BC Place', city: 'Vancouver', country: 'Canada', capacity: 54500 },
  ]
  for (const venue of venueData) {
    await db.insert(venues).values(venue).onConflictDoNothing()
  }

  // ─── Resolve team IDs (seeded by seed.ts) ──────────────────────────────────
  const ARG = await teamId('ARG')
  const BRA = await teamId('BRA')
  const GER = await teamId('GER')
  const FRA = await teamId('FRA')
  const ESP = await teamId('ESP')
  const ENG = await teamId('ENG')
  const NED = await teamId('NED')
  const POR = await teamId('POR')
  const ITA = await teamId('ITA')
  const USA = await teamId('USA')

  // ─── Users ─────────────────────────────────────────────────────────────────
  await db.insert(users).values({
    id: ADMIN_USER_ID,
    supabaseId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dev.local',
    displayName: 'Admin',
    role: 'admin',
  })

  const dummyUsers = [
    { id: USER_PETER_ID, supabaseId: '00000000-0000-0000-0000-000000000002', email: 'peter@dev.local', displayName: 'Kovács Péter', role: 'user' as const },
    { id: USER_ANNA_ID,  supabaseId: '00000000-0000-0000-0000-000000000003', email: 'anna@dev.local',  displayName: 'Nagy Anna',    role: 'user' as const },
    { id: USER_BELA_ID,  supabaseId: '00000000-0000-0000-0000-000000000004', email: 'bela@dev.local',  displayName: 'Tóth Béla',    role: 'user' as const },
    { id: USER_KATA_ID,  supabaseId: '00000000-0000-0000-0000-000000000005', email: 'kata@dev.local',  displayName: 'Szabó Kata',   role: 'user' as const },
    { id: USER_MATE_ID,  supabaseId: '00000000-0000-0000-0000-000000000006', email: 'mate@dev.local',  displayName: 'Kiss Máté',    role: 'user' as const },
  ]
  for (const u of dummyUsers) {
    await db.insert(users).values(u)
  }

  // ─── League ────────────────────────────────────────────────────────────────
  await db.insert(leagues).values({
    id: LEAGUE_WC_ID,
    name: 'FIFA World Cup 2026',
    shortName: 'WC2026',
  })

  // ─── Players ───────────────────────────────────────────────────────────────
  const playerData = [
    { id: PLAYER_MESSI_ID, name: 'Lionel Messi', teamId: ARG, position: 'forward', shirtNumber: 10 },
    { id: PLAYER_ALVAREZ_ID, name: 'Julián Álvarez', teamId: ARG, position: 'forward', shirtNumber: 9 },
    { id: PLAYER_VINICIUS_ID, name: 'Vinícius Jr.', teamId: BRA, position: 'forward', shirtNumber: 7 },
    { id: PLAYER_MUSIALA_ID, name: 'Jamal Musiala', teamId: GER, position: 'midfielder', shirtNumber: 10 },
  ]
  for (const p of playerData) {
    await db.insert(players).values(p)
  }

  // ─── Matches (10) ──────────────────────────────────────────────────────────
  const now = new Date()
  const day = (offset: number): Date => new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)

  const matchData = [
    { id: MATCH_1_ID,  homeTeamId: ARG, awayTeamId: BRA, venueId: VENUE_METLIFE_ID, leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'B', matchNumber: 1,  scheduledAt: day(-7), status: 'finished' as const },
    { id: MATCH_2_ID,  homeTeamId: GER, awayTeamId: FRA, venueId: VENUE_AZTECA_ID,  leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'H', matchNumber: 2,  scheduledAt: day(-6), status: 'finished' as const },
    { id: MATCH_3_ID,  homeTeamId: ESP, awayTeamId: ENG, venueId: VENUE_ATT_ID,     leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'E', matchNumber: 3,  scheduledAt: day(-5), status: 'finished' as const },
    { id: MATCH_4_ID,  homeTeamId: NED, awayTeamId: ITA, venueId: VENUE_METLIFE_ID, leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'F', matchNumber: 4,  scheduledAt: day(-4), status: 'finished' as const },
    { id: MATCH_5_ID,  homeTeamId: POR, awayTeamId: ARG, venueId: VENUE_AZTECA_ID,  leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'E', matchNumber: 5,  scheduledAt: day(0),  status: 'live' as const },
    { id: MATCH_6_ID,  homeTeamId: BRA, awayTeamId: GER, venueId: VENUE_ATT_ID,     leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'D', matchNumber: 6,  scheduledAt: day(0),  status: 'live' as const },
    { id: MATCH_7_ID,  homeTeamId: FRA, awayTeamId: ESP, venueId: VENUE_METLIFE_ID, leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'F', matchNumber: 7,  scheduledAt: day(3),  status: 'scheduled' as const },
    { id: MATCH_8_ID,  homeTeamId: ENG, awayTeamId: NED, venueId: VENUE_AZTECA_ID,  leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'G', matchNumber: 8,  scheduledAt: day(5),  status: 'scheduled' as const },
    { id: MATCH_9_ID,  homeTeamId: ITA, awayTeamId: POR, venueId: VENUE_ATT_ID,     leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'J', matchNumber: 9,  scheduledAt: day(7),  status: 'scheduled' as const },
    { id: MATCH_10_ID, homeTeamId: USA, awayTeamId: ARG, venueId: VENUE_METLIFE_ID, leagueId: LEAGUE_WC_ID, stage: 'group' as const, groupName: 'A', matchNumber: 10, scheduledAt: day(10), status: 'scheduled' as const },
  ]
  for (const m of matchData) {
    await db.insert(matches).values(m)
  }

  // ─── Match Results (4 finished) ────────────────────────────────────────────
  const resultData = [
    { id: RESULT_1_ID, matchId: MATCH_1_ID, homeGoals: 2, awayGoals: 1, recordedBy: ADMIN_USER_ID },
    { id: RESULT_2_ID, matchId: MATCH_2_ID, homeGoals: 0, awayGoals: 0, recordedBy: ADMIN_USER_ID },
    { id: RESULT_3_ID, matchId: MATCH_3_ID, homeGoals: 3, awayGoals: 1, recordedBy: ADMIN_USER_ID },
    { id: RESULT_4_ID, matchId: MATCH_4_ID, homeGoals: 1, awayGoals: 1, recordedBy: ADMIN_USER_ID },
  ]
  for (const r of resultData) {
    await db.insert(matchResults).values(r)
  }

  // ─── Predictions ───────────────────────────────────────────────────────────
  // Results: M1: ARG 2-1 BRA | M2: GER 0-0 FRA | M3: ESP 3-1 ENG | M4: NED 1-1 ITA

  interface PredSeed {
    userId: string
    matchId: string
    homeGoals: number
    awayGoals: number
    pointsGlobal: number | null
  }

  const predictionData: PredSeed[] = [
    // Admin: tippel mind a 4 finished meccsre (fixes "Mások tippjei" visibility)
    { userId: ADMIN_USER_ID, matchId: MATCH_1_ID, homeGoals: 2, awayGoals: 0, pointsGlobal: calcPoints(2, 0, 2, 1) },
    { userId: ADMIN_USER_ID, matchId: MATCH_2_ID, homeGoals: 1, awayGoals: 0, pointsGlobal: calcPoints(1, 0, 0, 0) },
    { userId: ADMIN_USER_ID, matchId: MATCH_3_ID, homeGoals: 2, awayGoals: 1, pointsGlobal: calcPoints(2, 1, 3, 1) },
    { userId: ADMIN_USER_ID, matchId: MATCH_4_ID, homeGoals: 0, awayGoals: 0, pointsGlobal: calcPoints(0, 0, 1, 1) },

    // Kovács Péter: strong tipper (9 pts)
    { userId: USER_PETER_ID, matchId: MATCH_1_ID, homeGoals: 2, awayGoals: 1, pointsGlobal: calcPoints(2, 1, 2, 1) },
    { userId: USER_PETER_ID, matchId: MATCH_2_ID, homeGoals: 1, awayGoals: 1, pointsGlobal: calcPoints(1, 1, 0, 0) },
    { userId: USER_PETER_ID, matchId: MATCH_3_ID, homeGoals: 2, awayGoals: 0, pointsGlobal: calcPoints(2, 0, 3, 1) },
    { userId: USER_PETER_ID, matchId: MATCH_4_ID, homeGoals: 1, awayGoals: 1, pointsGlobal: calcPoints(1, 1, 1, 1) },
    { userId: USER_PETER_ID, matchId: MATCH_7_ID, homeGoals: 2, awayGoals: 1, pointsGlobal: null },
    { userId: USER_PETER_ID, matchId: MATCH_8_ID, homeGoals: 1, awayGoals: 0, pointsGlobal: null },

    // Nagy Anna: medium tipper (7 pts)
    { userId: USER_ANNA_ID, matchId: MATCH_1_ID, homeGoals: 1, awayGoals: 0, pointsGlobal: calcPoints(1, 0, 2, 1) },
    { userId: USER_ANNA_ID, matchId: MATCH_2_ID, homeGoals: 0, awayGoals: 0, pointsGlobal: calcPoints(0, 0, 0, 0) },
    { userId: USER_ANNA_ID, matchId: MATCH_3_ID, homeGoals: 1, awayGoals: 2, pointsGlobal: calcPoints(1, 2, 3, 1) },
    { userId: USER_ANNA_ID, matchId: MATCH_4_ID, homeGoals: 2, awayGoals: 2, pointsGlobal: calcPoints(2, 2, 1, 1) },
    { userId: USER_ANNA_ID, matchId: MATCH_9_ID, homeGoals: 0, awayGoals: 1, pointsGlobal: null },

    // Tóth Béla: weak tipper (3 pts)
    { userId: USER_BELA_ID, matchId: MATCH_1_ID, homeGoals: 0, awayGoals: 2, pointsGlobal: calcPoints(0, 2, 2, 1) },
    { userId: USER_BELA_ID, matchId: MATCH_2_ID, homeGoals: 2, awayGoals: 1, pointsGlobal: calcPoints(2, 1, 0, 0) },
    { userId: USER_BELA_ID, matchId: MATCH_3_ID, homeGoals: 3, awayGoals: 1, pointsGlobal: calcPoints(3, 1, 3, 1) },
    { userId: USER_BELA_ID, matchId: MATCH_4_ID, homeGoals: 0, awayGoals: 1, pointsGlobal: calcPoints(0, 1, 1, 1) },

    // Szabó Kata: decent tipper (8 pts)
    { userId: USER_KATA_ID, matchId: MATCH_1_ID, homeGoals: 3, awayGoals: 1, pointsGlobal: calcPoints(3, 1, 2, 1) },
    { userId: USER_KATA_ID, matchId: MATCH_2_ID, homeGoals: 0, awayGoals: 0, pointsGlobal: calcPoints(0, 0, 0, 0) },
    { userId: USER_KATA_ID, matchId: MATCH_3_ID, homeGoals: 2, awayGoals: 1, pointsGlobal: calcPoints(2, 1, 3, 1) },
    { userId: USER_KATA_ID, matchId: MATCH_4_ID, homeGoals: 0, awayGoals: 0, pointsGlobal: calcPoints(0, 0, 1, 1) },
    { userId: USER_KATA_ID, matchId: MATCH_7_ID, homeGoals: 1, awayGoals: 1, pointsGlobal: null },
    { userId: USER_KATA_ID, matchId: MATCH_10_ID, homeGoals: 3, awayGoals: 0, pointsGlobal: null },

    // Kiss Máté: mixed tipper (6 pts)
    { userId: USER_MATE_ID, matchId: MATCH_1_ID, homeGoals: 2, awayGoals: 1, pointsGlobal: calcPoints(2, 1, 2, 1) },
    { userId: USER_MATE_ID, matchId: MATCH_2_ID, homeGoals: 1, awayGoals: 0, pointsGlobal: calcPoints(1, 0, 0, 0) },
    { userId: USER_MATE_ID, matchId: MATCH_3_ID, homeGoals: 0, awayGoals: 0, pointsGlobal: calcPoints(0, 0, 3, 1) },
    { userId: USER_MATE_ID, matchId: MATCH_4_ID, homeGoals: 1, awayGoals: 1, pointsGlobal: calcPoints(1, 1, 1, 1) },
    { userId: USER_MATE_ID, matchId: MATCH_8_ID, homeGoals: 2, awayGoals: 2, pointsGlobal: null },
  ]

  for (const p of predictionData) {
    await db.insert(predictions).values(p)
  }

  // ─── Groups ────────────────────────────────────────────────────────────────
  await db.insert(groups).values({
    id: GROUP_IRODA_ID,
    name: 'Irodai tippverseny',
    inviteCode: 'IRODA001',
    inviteActive: true,
    createdBy: ADMIN_USER_ID,
  })

  await db.insert(groups).values({
    id: GROUP_HAVEROK_ID,
    name: 'Haverok',
    inviteCode: 'HAVER001',
    inviteActive: true,
    createdBy: USER_PETER_ID,
  })

  // ─── Group Members ─────────────────────────────────────────────────────────
  const groupMemberData = [
    { groupId: GROUP_IRODA_ID, userId: ADMIN_USER_ID, isAdmin: true },
    { groupId: GROUP_IRODA_ID, userId: USER_PETER_ID, isAdmin: false },
    { groupId: GROUP_IRODA_ID, userId: USER_ANNA_ID,  isAdmin: false },
    { groupId: GROUP_IRODA_ID, userId: USER_BELA_ID,  isAdmin: false },
    { groupId: GROUP_HAVEROK_ID, userId: USER_PETER_ID, isAdmin: true },
    { groupId: GROUP_HAVEROK_ID, userId: ADMIN_USER_ID, isAdmin: false },
    { groupId: GROUP_HAVEROK_ID, userId: USER_ANNA_ID,  isAdmin: false },
    { groupId: GROUP_HAVEROK_ID, userId: USER_KATA_ID,  isAdmin: false },
    { groupId: GROUP_HAVEROK_ID, userId: USER_MATE_ID,  isAdmin: false },
  ]
  for (const gm of groupMemberData) {
    await db.insert(groupMembers).values(gm)
  }

  // ─── Group Prediction Points ───────────────────────────────────────────────
  // For each finished-match prediction where user is in a group, add group points
  const finishedPredictions = predictionData.filter(p => p.pointsGlobal !== null)

  // Get prediction IDs by querying DB (since we don't set them manually)
  for (const pred of finishedPredictions) {
    const predRows = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(eq(predictions.userId, pred.userId))
      .limit(100)

    const matchPredRows = await db
      .select({ id: predictions.id })
      .from(predictions)
      .where(eq(predictions.matchId, pred.matchId))
      .limit(100)

    const predRow = predRows.find(r => matchPredRows.some(mr => mr.id === r.id))
    if (!predRow) continue

    const userGroups = groupMemberData.filter(gm => gm.userId === pred.userId)
    for (const ug of userGroups) {
      await db.insert(groupPredictionPoints).values({
        predictionId: predRow.id,
        groupId: ug.groupId,
        points: pred.pointsGlobal!,
      }).onConflictDoNothing()
    }
  }

  // ─── Special Prediction Types ──────────────────────────────────────────────
  await db.insert(specialPredictionTypes).values({
    id: SPT_GOLKIRALY_ID,
    groupId: null,
    name: 'Gólkirály',
    description: 'Ki lesz a 2026-os VB gólkirálya?',
    inputType: 'player_select',
    deadline: day(30),
    points: 5,
    isGlobal: true,
    isActive: true,
  })

  await db.insert(specialPredictionTypes).values({
    id: SPT_WINNER_ID,
    groupId: GROUP_IRODA_ID,
    name: 'VB Győztes',
    description: 'Melyik csapat nyeri a 2026-os VB-t?',
    inputType: 'team_select',
    deadline: day(30),
    points: 10,
    isGlobal: false,
    isActive: true,
  })

  await db.insert(specialPredictionTypes).values({
    id: SPT_CSOPORTGYOZTES_ID,
    groupId: GROUP_HAVEROK_ID,
    name: 'B csoport győztes',
    description: 'Ki nyeri a B csoportot?',
    inputType: 'team_select',
    deadline: day(15),
    points: 3,
    isGlobal: false,
    isActive: true,
  })

  // ─── Group Global Type Subscriptions ───────────────────────────────────────
  await db.insert(groupGlobalTypeSubscriptions).values({
    groupId: GROUP_IRODA_ID,
    globalTypeId: SPT_GOLKIRALY_ID,
  })
  await db.insert(groupGlobalTypeSubscriptions).values({
    groupId: GROUP_HAVEROK_ID,
    globalTypeId: SPT_GOLKIRALY_ID,
  })

  // ─── Special Predictions (mix answered/pending) ────────────────────────────
  const specialPredData = [
    { userId: USER_PETER_ID, typeId: SPT_GOLKIRALY_ID, groupId: GROUP_IRODA_ID, answer: PLAYER_MESSI_ID },
    { userId: USER_PETER_ID, typeId: SPT_WINNER_ID,    groupId: GROUP_IRODA_ID, answer: ARG },
    { userId: USER_ANNA_ID,  typeId: SPT_GOLKIRALY_ID, groupId: GROUP_IRODA_ID, answer: PLAYER_VINICIUS_ID },
    { userId: USER_KATA_ID,  typeId: SPT_CSOPORTGYOZTES_ID, groupId: GROUP_HAVEROK_ID, answer: ARG },
    { userId: USER_ANNA_ID,  typeId: SPT_GOLKIRALY_ID, groupId: GROUP_HAVEROK_ID, answer: PLAYER_VINICIUS_ID },
    { userId: USER_MATE_ID,  typeId: SPT_GOLKIRALY_ID, groupId: GROUP_HAVEROK_ID, answer: PLAYER_MUSIALA_ID },
  ]
  for (const sp of specialPredData) {
    await db.insert(specialPredictions).values(sp)
  }

  // ─── Waitlist Entries ──────────────────────────────────────────────────────
  await db.insert(waitlistEntries).values([
    { email: 'test1@example.com', source: 'hero' as const },
    { email: 'test2@example.com', source: 'footer' as const },
    { email: 'test3@example.com', source: 'admin' as const },
  ])

  // ─── Audit Logs ────────────────────────────────────────────────────────────
  await db.insert(auditLogs).values({
    actorId: ADMIN_USER_ID,
    action: 'result_set',
    entityType: 'match',
    entityId: MATCH_1_ID,
    newValue: { homeGoals: 2, awayGoals: 1 },
  })
  await db.insert(auditLogs).values({
    actorId: ADMIN_USER_ID,
    action: 'role_change',
    entityType: 'user',
    entityId: USER_PETER_ID,
    previousValue: { role: 'user' },
    newValue: { role: 'admin' },
  })

  // ─── NB I Liga + 32. forduló ────────────────────────────────────────────────
  const LEAGUE_NB1_ID = 'bbbbbbbb-1111-2222-3333-000000000002'

  await db.insert(leagues).values({
    id: LEAGUE_NB1_ID,
    name: 'NB I 2025/26',
    shortName: 'NB I',
  })

  const ZTE = await teamId('ZTE')
  const PAFC = await teamId('PAFC')
  const MTK = await teamId('MTK')
  const NYIR = await teamId('NYIR')
  const KBSC = await teamId('KBSC')
  const KISV = await teamId('KISV')
  const ETO_TEAM = await teamId('ETO')
  const DVTK_TEAM = await teamId('DVTK')
  const PAKS = await teamId('PAKS')
  const DVSC = await teamId('DVSC')
  const UJP = await teamId('UJP')
  const FTC = await teamId('FTC')

  const nb1Matches = [
    { homeTeamId: ZTE,      awayTeamId: PAFC,      leagueId: LEAGUE_NB1_ID, stage: 'group' as const, groupName: '32. forduló', matchNumber: 1, scheduledAt: new Date('2026-05-01T18:00:00.000Z'), status: 'scheduled' as const },
    { homeTeamId: MTK,      awayTeamId: NYIR,      leagueId: LEAGUE_NB1_ID, stage: 'group' as const, groupName: '32. forduló', matchNumber: 2, scheduledAt: new Date('2026-05-02T11:00:00.000Z'), status: 'scheduled' as const },
    { homeTeamId: KBSC,     awayTeamId: KISV,      leagueId: LEAGUE_NB1_ID, stage: 'group' as const, groupName: '32. forduló', matchNumber: 3, scheduledAt: new Date('2026-05-02T14:00:00.000Z'), status: 'scheduled' as const },
    { homeTeamId: ETO_TEAM, awayTeamId: DVTK_TEAM, leagueId: LEAGUE_NB1_ID, stage: 'group' as const, groupName: '32. forduló', matchNumber: 4, scheduledAt: new Date('2026-05-02T17:15:00.000Z'), status: 'scheduled' as const },
    { homeTeamId: PAKS,     awayTeamId: DVSC,      leagueId: LEAGUE_NB1_ID, stage: 'group' as const, groupName: '32. forduló', matchNumber: 5, scheduledAt: new Date('2026-05-03T11:30:00.000Z'), status: 'scheduled' as const },
    { homeTeamId: UJP,      awayTeamId: FTC,       leagueId: LEAGUE_NB1_ID, stage: 'group' as const, groupName: '32. forduló', matchNumber: 6, scheduledAt: new Date('2026-05-03T14:00:00.000Z'), status: 'scheduled' as const },
  ]
  for (const m of nb1Matches) {
    await db.insert(matches).values(m)
  }

  console.log('Local seed complete.')
  console.log('  Users: 1 admin + 5 dummy')
  console.log('  Players: 4')
  console.log('  Matches: 4 finished, 2 live, 4 scheduled (WC) + 6 scheduled (NB I)')
  console.log('  Predictions: 31 (6 users × finished + scheduled mix)')
  console.log('  Groups: "Irodai tippverseny" (4 members), "Haverok" (5 members)')
  console.log('  Group prediction points: per-group scoring for finished matches')
  console.log('  Special prediction types: 3 (1 global, 2 group-specific)')
  console.log('  Special predictions: 6 (mix answered)')
  console.log('  Waitlist entries: 3')
  console.log('  Audit logs: 2')
  console.log('  NB I 32. forduló: 6 matches')
  process.exit(0)
}

seedLocal().catch((err: unknown) => {
  console.error('Local seed failed:', err)
  process.exit(1)
})
