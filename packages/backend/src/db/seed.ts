import { db } from './client.js'
import {
  scoringConfigs, venues, teams, users, matches,
} from './schema/index.js'

async function seed(): Promise<void> {
  console.log('Seeding database...')

  // Scoring config
  await db.insert(scoringConfigs).values({
    name: 'Global Default',
    isGlobalDefault: true,
    exactScore: 3,
    correctWinnerAndDiff: 2,
    correctWinner: 1,
    correctDraw: 2,
    incorrect: 0,
  }).onConflictDoNothing()

  // Venues (FIFA 2026)
  const venueData = [
    { name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA', capacity: 82500 },
    { name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', capacity: 87523 },
    { name: 'AT&T Stadium', city: 'Arlington', country: 'USA', capacity: 80000 },
    { name: 'SoFi Stadium', city: 'Inglewood', country: 'USA', capacity: 70240 },
    { name: 'Estadio AKRON', city: 'Guadalajara', country: 'Mexico', capacity: 49850 },
    { name: 'BC Place', city: 'Vancouver', country: 'Canada', capacity: 54500 },
  ]

  for (const venue of venueData) {
    await db.insert(venues).values(venue).onConflictDoNothing()
  }

  // Teams (FIFA VB 2026 – 32 résztvevő)
  const teamData = [
    // Group A
    { name: 'Qatar', shortCode: 'QAT', group: 'A' },
    { name: 'Ecuador', shortCode: 'ECU', group: 'A' },
    { name: 'Senegal', shortCode: 'SEN', group: 'A' },
    { name: 'Netherlands', shortCode: 'NED', group: 'A' },
    // Group B
    { name: 'England', shortCode: 'ENG', group: 'B' },
    { name: 'Iran', shortCode: 'IRN', group: 'B' },
    { name: 'USA', shortCode: 'USA', group: 'B' },
    { name: 'Wales', shortCode: 'WAL', group: 'B' },
    // Group C
    { name: 'Argentina', shortCode: 'ARG', group: 'C' },
    { name: 'Saudi Arabia', shortCode: 'KSA', group: 'C' },
    { name: 'Mexico', shortCode: 'MEX', group: 'C' },
    { name: 'Poland', shortCode: 'POL', group: 'C' },
    // Group D
    { name: 'France', shortCode: 'FRA', group: 'D' },
    { name: 'Australia', shortCode: 'AUS', group: 'D' },
    { name: 'Denmark', shortCode: 'DEN', group: 'D' },
    { name: 'Tunisia', shortCode: 'TUN', group: 'D' },
    // Group E
    { name: 'Spain', shortCode: 'ESP', group: 'E' },
    { name: 'Costa Rica', shortCode: 'CRC', group: 'E' },
    { name: 'Germany', shortCode: 'GER', group: 'E' },
    { name: 'Japan', shortCode: 'JPN', group: 'E' },
    // Group F
    { name: 'Belgium', shortCode: 'BEL', group: 'F' },
    { name: 'Canada', shortCode: 'CAN', group: 'F' },
    { name: 'Morocco', shortCode: 'MAR', group: 'F' },
    { name: 'Croatia', shortCode: 'CRO', group: 'F' },
    // Group G
    { name: 'Brazil', shortCode: 'BRA', group: 'G' },
    { name: 'Serbia', shortCode: 'SRB', group: 'G' },
    { name: 'Switzerland', shortCode: 'SUI', group: 'G' },
    { name: 'Cameroon', shortCode: 'CMR', group: 'G' },
    // Group H
    { name: 'Portugal', shortCode: 'POR', group: 'H' },
    { name: 'Ghana', shortCode: 'GHA', group: 'H' },
    { name: 'Uruguay', shortCode: 'URU', group: 'H' },
    { name: 'South Korea', shortCode: 'KOR', group: 'H' },
  ]

  for (const team of teamData) {
    await db.insert(teams).values(team).onConflictDoNothing()
  }

  // Admin user (dev only, mock supabase_id)
  await db.insert(users).values({
    supabaseId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dev.local',
    displayName: 'Admin',
    role: 'admin',
  }).onConflictDoNothing()

  // Fetch inserted teams and venues to use their IDs for matches
  const allTeams = await db.select().from(teams)
  const allVenues = await db.select().from(venues)

  const byCode = (code: string) => {
    const t = allTeams.find((t) => t.shortCode === code)
    if (!t) throw new Error(`Team not found: ${code}`)
    return t.id
  }

  const venue = (idx: number) => allVenues[idx]?.id ?? null

  const now = new Date()
  const past = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000)
  const future = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * 86400000)

  const matchData = [
    { homeTeamId: byCode('ARG'), awayTeamId: byCode('KSA'), venueId: venue(1), stage: 'group' as const, groupName: 'C', matchNumber: 1, scheduledAt: past(10), status: 'finished' as const },
    { homeTeamId: byCode('FRA'), awayTeamId: byCode('AUS'), venueId: venue(0), stage: 'group' as const, groupName: 'D', matchNumber: 2, scheduledAt: past(9), status: 'finished' as const },
    { homeTeamId: byCode('BRA'), awayTeamId: byCode('SRB'), venueId: venue(3), stage: 'group' as const, groupName: 'G', matchNumber: 3, scheduledAt: past(8), status: 'finished' as const },
    { homeTeamId: byCode('ESP'), awayTeamId: byCode('GER'), venueId: venue(2), stage: 'group' as const, groupName: 'E', matchNumber: 4, scheduledAt: past(3), status: 'live' as const },
    { homeTeamId: byCode('ENG'), awayTeamId: byCode('USA'), venueId: venue(0), stage: 'group' as const, groupName: 'B', matchNumber: 5, scheduledAt: past(2), status: 'live' as const },
    { homeTeamId: byCode('POR'), awayTeamId: byCode('URU'), venueId: venue(4), stage: 'group' as const, groupName: 'H', matchNumber: 6, scheduledAt: future(2), status: 'scheduled' as const },
    { homeTeamId: byCode('NED'), awayTeamId: byCode('ECU'), venueId: venue(5), stage: 'group' as const, groupName: 'A', matchNumber: 7, scheduledAt: future(3), status: 'scheduled' as const },
    { homeTeamId: byCode('BEL'), awayTeamId: byCode('CAN'), venueId: venue(1), stage: 'group' as const, groupName: 'F', matchNumber: 8, scheduledAt: future(5), status: 'scheduled' as const },
    { homeTeamId: byCode('CRO'), awayTeamId: byCode('MAR'), venueId: venue(2), stage: 'group' as const, groupName: 'F', matchNumber: 9, scheduledAt: future(7), status: 'scheduled' as const },
    { homeTeamId: byCode('MEX'), awayTeamId: byCode('POL'), venueId: venue(1), stage: 'group' as const, groupName: 'C', matchNumber: 10, scheduledAt: future(1), status: 'cancelled' as const },
  ]

  for (const match of matchData) {
    await db.insert(matches).values(match).onConflictDoNothing()
  }

  console.log('Seed complete.')
  process.exit(0)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
