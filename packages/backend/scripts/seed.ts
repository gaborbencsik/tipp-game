import { db } from '../src/db/client.js'
import { eq, sql } from 'drizzle-orm'
import { scoringConfigs, teams, venues, leagues } from '../src/db/schema/index.js'

async function seed(): Promise<void> {
  console.log('Seeding base data...')

  // ─── Scoring config ──────────────────────────────────────────────────────
  await db.insert(scoringConfigs).values({
    name: 'Global Default',
    isGlobalDefault: true,
    exactScore: 3,
    correctWinnerAndDiff: 2,
    correctWinner: 1,
    correctDraw: 2,
    incorrect: 0,
  }).onConflictDoNothing()

  // ─── Venues (FIFA 2026) ──────────────────────────────────────────────────
  const venueData = [
    { name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA', capacity: 82500, imageUrl: '/venues/metlife-stadium.webp' },
    { name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', capacity: 87523, imageUrl: '/venues/estadio-azteca.webp' },
    { name: 'AT&T Stadium', city: 'Arlington', country: 'USA', capacity: 80000, imageUrl: '/venues/att-stadium.webp' },
    { name: 'SoFi Stadium', city: 'Inglewood', country: 'USA', capacity: 70240, imageUrl: '/venues/sofi-stadium.webp' },
    { name: 'Estadio AKRON', city: 'Guadalajara', country: 'Mexico', capacity: 49850, imageUrl: '/venues/estadio-akron.webp' },
    { name: 'BC Place', city: 'Vancouver', country: 'Canada', capacity: 54500, imageUrl: '/venues/bc-place.webp' },
    { name: 'Hard Rock Stadium', city: 'Miami Gardens', country: 'USA', capacity: 64767, imageUrl: '/venues/hard-rock-stadium.webp' },
    { name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA', capacity: 69176, imageUrl: '/venues/lincoln-financial-field.webp' },
    { name: 'NRG Stadium', city: 'Houston', country: 'USA', capacity: 72220, imageUrl: '/venues/nrg-stadium.webp' },
    { name: 'Lumen Field', city: 'Seattle', country: 'USA', capacity: 68740, imageUrl: '/venues/lumen-field.webp' },
    { name: "Levi's Stadium", city: 'Santa Clara', country: 'USA', capacity: 68500, imageUrl: '/venues/levis-stadium.webp' },
    { name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA', capacity: 71000, imageUrl: '/venues/mercedes-benz-stadium.webp' },
    { name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA', capacity: 76416, imageUrl: '/venues/arrowhead-stadium.webp' },
    { name: 'Gillette Stadium', city: 'Foxborough', country: 'USA', capacity: 65878, imageUrl: '/venues/gillette-stadium.webp' },
    { name: 'Estadio BBVA', city: 'Monterrey', country: 'Mexico', capacity: 53500, imageUrl: '/venues/estadio-bbva.webp' },
    { name: 'BMO Field', city: 'Toronto', country: 'Canada', capacity: 30000, imageUrl: '/venues/bmo-field.webp' },
  ]

  for (const venue of venueData) {
    await db.insert(venues).values(venue).onConflictDoNothing()
  }

  // Update imageUrl for all venues matching by name (case-insensitive)
  for (const venue of venueData) {
    await db.update(venues).set({ imageUrl: venue.imageUrl }).where(sql`lower(${venues.name}) = lower(${venue.name})`)
  }

  // ─── Teams (FIFA VB 2026 – 48 + NB I) ───────────────────────────────────
  const teamData = [
    // Group A
    { name: 'USA', shortCode: 'USA', group: 'A', teamType: 'national' as const, countryCode: 'us' },
    { name: 'Mexikó', shortCode: 'MEX', group: 'A', teamType: 'national' as const, countryCode: 'mx' },
    { name: 'Kanada', shortCode: 'CAN', group: 'A', teamType: 'national' as const, countryCode: 'ca' },
    { name: 'Panama', shortCode: 'PAN', group: 'A', teamType: 'national' as const, countryCode: 'pa' },
    // Group B
    { name: 'Argentína', shortCode: 'ARG', group: 'B', teamType: 'national' as const, countryCode: 'ar' },
    { name: 'Chile', shortCode: 'CHI', group: 'B', teamType: 'national' as const, countryCode: 'cl' },
    { name: 'Peru', shortCode: 'PER', group: 'B', teamType: 'national' as const, countryCode: 'pe' },
    { name: 'Ausztrália', shortCode: 'AUS', group: 'B', teamType: 'national' as const, countryCode: 'au' },
    // Group C
    { name: 'Ecuador', shortCode: 'ECU', group: 'C', teamType: 'national' as const, countryCode: 'ec' },
    { name: 'Venezuela', shortCode: 'VEN', group: 'C', teamType: 'national' as const, countryCode: 've' },
    { name: 'Új-Zéland', shortCode: 'NZL', group: 'C', teamType: 'national' as const, countryCode: 'nz' },
    // Group D
    { name: 'Brazília', shortCode: 'BRA', group: 'D', teamType: 'national' as const, countryCode: 'br' },
    { name: 'Kolumbia', shortCode: 'COL', group: 'D', teamType: 'national' as const, countryCode: 'co' },
    { name: 'Paraguay', shortCode: 'PAR', group: 'D', teamType: 'national' as const, countryCode: 'py' },
    { name: 'Kamerun', shortCode: 'CMR', group: 'D', teamType: 'national' as const, countryCode: 'cm' },
    // Group E
    { name: 'Spanyolország', shortCode: 'ESP', group: 'E', teamType: 'national' as const, countryCode: 'es' },
    { name: 'Portugália', shortCode: 'POR', group: 'E', teamType: 'national' as const, countryCode: 'pt' },
    { name: 'Skócia', shortCode: 'SCO', group: 'E', teamType: 'national' as const, countryCode: 'gb-sct' },
    { name: 'Marokkó', shortCode: 'MAR', group: 'E', teamType: 'national' as const, countryCode: 'ma' },
    // Group F
    { name: 'Franciaország', shortCode: 'FRA', group: 'F', teamType: 'national' as const, countryCode: 'fr' },
    { name: 'Hollandia', shortCode: 'NED', group: 'F', teamType: 'national' as const, countryCode: 'nl' },
    { name: 'Szenegál', shortCode: 'SEN', group: 'F', teamType: 'national' as const, countryCode: 'sn' },
    { name: 'Dél-Korea', shortCode: 'KOR', group: 'F', teamType: 'national' as const, countryCode: 'kr' },
    // Group G
    { name: 'Anglia', shortCode: 'ENG', group: 'G', teamType: 'national' as const, countryCode: 'gb-eng' },
    { name: 'Horvátország', shortCode: 'CRO', group: 'G', teamType: 'national' as const, countryCode: 'hr' },
    { name: 'Nigéria', shortCode: 'NGA', group: 'G', teamType: 'national' as const, countryCode: 'ng' },
    { name: 'Szerbia', shortCode: 'SRB', group: 'G', teamType: 'national' as const, countryCode: 'rs' },
    // Group H
    { name: 'Németország', shortCode: 'GER', group: 'H', teamType: 'national' as const, countryCode: 'de' },
    { name: 'Japán', shortCode: 'JPN', group: 'H', teamType: 'national' as const, countryCode: 'jp' },
    { name: 'Szaúd-Arábia', shortCode: 'KSA', group: 'H', teamType: 'national' as const, countryCode: 'sa' },
    { name: 'Tunézia', shortCode: 'TUN', group: 'H', teamType: 'national' as const, countryCode: 'tn' },
    // Group I
    { name: 'Belgium', shortCode: 'BEL', group: 'I', teamType: 'national' as const, countryCode: 'be' },
    { name: 'Ukrajna', shortCode: 'UKR', group: 'I', teamType: 'national' as const, countryCode: 'ua' },
    { name: 'Mali', shortCode: 'MLI', group: 'I', teamType: 'national' as const, countryCode: 'ml' },
    { name: 'Costa Rica', shortCode: 'CRC', group: 'I', teamType: 'national' as const, countryCode: 'cr' },
    // Group J
    { name: 'Olaszország', shortCode: 'ITA', group: 'J', teamType: 'national' as const, countryCode: 'it' },
    { name: 'Svájc', shortCode: 'SUI', group: 'J', teamType: 'national' as const, countryCode: 'ch' },
    { name: 'Elefántcsontpart', shortCode: 'CIV', group: 'J', teamType: 'national' as const, countryCode: 'ci' },
    { name: 'Honduras', shortCode: 'HON', group: 'J', teamType: 'national' as const, countryCode: 'hn' },
    // Group K
    { name: 'Lengyelország', shortCode: 'POL', group: 'K', teamType: 'national' as const, countryCode: 'pl' },
    { name: 'Ghána', shortCode: 'GHA', group: 'K', teamType: 'national' as const, countryCode: 'gh' },
    { name: 'Uruguay', shortCode: 'URU', group: 'K', teamType: 'national' as const, countryCode: 'uy' },
    // Group L
    { name: 'Dánia', shortCode: 'DEN', group: 'L', teamType: 'national' as const, countryCode: 'dk' },
    { name: 'Ausztria', shortCode: 'AUT', group: 'L', teamType: 'national' as const, countryCode: 'at' },
    { name: 'Egyiptom', shortCode: 'EGY', group: 'L', teamType: 'national' as const, countryCode: 'eg' },
    { name: 'Katar', shortCode: 'QAT', group: 'L', teamType: 'national' as const, countryCode: 'qa' },
    // NB I 2025/26
    { name: 'Ferencváros', shortCode: 'FTC', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/ftc.svg' },
    { name: 'Puskás Akadémia', shortCode: 'PAFC', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/pafc.svg' },
    { name: 'Paksi FC', shortCode: 'PAKS', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/paks.svg' },
    { name: 'Debreceni VSC', shortCode: 'DVSC', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/dvsc.svg' },
    { name: 'MTK Budapest', shortCode: 'MTK', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/mtk.svg' },
    { name: 'Győri ETO', shortCode: 'ETO', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/eto.png' },
    { name: 'Kisvárda FC', shortCode: 'KISV', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/kisv.png' },
    { name: 'ZTE FC', shortCode: 'ZTE', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/zte.svg' },
    { name: 'Újpest FC', shortCode: 'UJP', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/ujp.svg' },
    { name: 'Nyíregyháza Spartacus', shortCode: 'NYIR', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: null },
    { name: 'DVTK', shortCode: 'DVTK', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: '/logos/dvtk.svg' },
    { name: 'Kolorcity Kazincbarcika SC', shortCode: 'KBSC', group: 'NB I', teamType: 'club' as const, countryCode: null, flagUrl: null },
  ]

  for (const team of teamData) {
    await db.insert(teams).values(team).onConflictDoNothing()
  }

  // ─── Leagues ────────────────────────────────────────────────────────────
  const leagueData = [
    { name: 'FIFA World Cup 2026', shortName: 'WC2026' },
    { name: 'NB I 2025/26', shortName: 'NB I' },
  ]

  for (const league of leagueData) {
    await db.insert(leagues).values(league).onConflictDoNothing()
  }

  console.log('Base seed complete.')
  console.log('  Scoring config: Global Default')
  console.log('  Venues: 6')
  console.log('  Teams: 48 VB + 12 NB I')
  console.log('  Leagues: 2')
  process.exit(0)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
