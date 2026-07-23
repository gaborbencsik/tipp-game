import { db } from '../src/db/client.js'
import { eq, sql } from 'drizzle-orm'
import { scoringConfigs, teams, venues, leagues } from '../src/db/schema/index.js'

async function seed(): Promise<void> {
  console.log('Seeding base data...')

  // ─── Scoring config ──────────────────────────────────────────────────────
  // Guard against duplicate global-default rows: onConflictDoNothing can't dedupe
  // here (no unique constraint on is_global_default), so re-running the seed would
  // otherwise insert a second global default and make loadGlobalConfigRow ambiguous.
  const existingGlobal = await db
    .select({ id: scoringConfigs.id })
    .from(scoringConfigs)
    .where(eq(scoringConfigs.isGlobalDefault, true))
    .limit(1)
  if (existingGlobal.length === 0) {
    await db.insert(scoringConfigs).values({
      name: 'Global Default',
      isGlobalDefault: true,
      correctOutcomePoints: 1,
      exactBonusPoints: 1,
      extraTimeBonusPoints: 1,
    })
  }

  // ─── Venues (FIFA 2026) ──────────────────────────────────────────────────
  const venueData = [
    { name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA', capacity: 82500, imageUrl: '/venues/metlife-stadium.webp' },
    { name: 'Estadio Banorte', city: 'Mexico City', country: 'Mexico', capacity: 87523, imageUrl: '/venues/estadio-azteca.webp' },
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
  // Csoportbeosztás a 2025-12-05-i hivatalos sorsolás alapján.
  const teamData = [
    // Group A
    { name: 'Csehország', shortCode: 'CZE', group: 'A', teamType: 'national' as const, countryCode: 'cz' },
    { name: 'Mexikó', shortCode: 'MEX', group: 'A', teamType: 'national' as const, countryCode: 'mx' },
    { name: 'Dél-afrikai Köztársaság', shortCode: 'RSA', group: 'A', teamType: 'national' as const, countryCode: 'za' },
    { name: 'Dél-Korea', shortCode: 'KOR', group: 'A', teamType: 'national' as const, countryCode: 'kr' },
    // Group B
    { name: 'Bosznia-Hercegovina', shortCode: 'BIH', group: 'B', teamType: 'national' as const, countryCode: 'ba' },
    { name: 'Kanada', shortCode: 'CAN', group: 'B', teamType: 'national' as const, countryCode: 'ca' },
    { name: 'Katar', shortCode: 'QAT', group: 'B', teamType: 'national' as const, countryCode: 'qa' },
    { name: 'Svájc', shortCode: 'SUI', group: 'B', teamType: 'national' as const, countryCode: 'ch' },
    // Group C
    { name: 'Brazília', shortCode: 'BRA', group: 'C', teamType: 'national' as const, countryCode: 'br' },
    { name: 'Haiti', shortCode: 'HAI', group: 'C', teamType: 'national' as const, countryCode: 'ht' },
    { name: 'Marokkó', shortCode: 'MAR', group: 'C', teamType: 'national' as const, countryCode: 'ma' },
    { name: 'Skócia', shortCode: 'SCO', group: 'C', teamType: 'national' as const, countryCode: 'gb-sct' },
    // Group D
    { name: 'Ausztrália', shortCode: 'AUS', group: 'D', teamType: 'national' as const, countryCode: 'au' },
    { name: 'Paraguay', shortCode: 'PAR', group: 'D', teamType: 'national' as const, countryCode: 'py' },
    { name: 'Törökország', shortCode: 'TUR', group: 'D', teamType: 'national' as const, countryCode: 'tr' },
    { name: 'USA', shortCode: 'USA', group: 'D', teamType: 'national' as const, countryCode: 'us' },
    // Group E
    { name: 'Curaçao', shortCode: 'CUW', group: 'E', teamType: 'national' as const, countryCode: 'cw' },
    { name: 'Ecuador', shortCode: 'ECU', group: 'E', teamType: 'national' as const, countryCode: 'ec' },
    { name: 'Németország', shortCode: 'GER', group: 'E', teamType: 'national' as const, countryCode: 'de' },
    { name: 'Elefántcsontpart', shortCode: 'CIV', group: 'E', teamType: 'national' as const, countryCode: 'ci' },
    // Group F
    { name: 'Japán', shortCode: 'JPN', group: 'F', teamType: 'national' as const, countryCode: 'jp' },
    { name: 'Hollandia', shortCode: 'NED', group: 'F', teamType: 'national' as const, countryCode: 'nl' },
    { name: 'Svédország', shortCode: 'SWE', group: 'F', teamType: 'national' as const, countryCode: 'se' },
    { name: 'Tunézia', shortCode: 'TUN', group: 'F', teamType: 'national' as const, countryCode: 'tn' },
    // Group G
    { name: 'Belgium', shortCode: 'BEL', group: 'G', teamType: 'national' as const, countryCode: 'be' },
    { name: 'Egyiptom', shortCode: 'EGY', group: 'G', teamType: 'national' as const, countryCode: 'eg' },
    { name: 'Irán', shortCode: 'IRN', group: 'G', teamType: 'national' as const, countryCode: 'ir' },
    { name: 'Új-Zéland', shortCode: 'NZL', group: 'G', teamType: 'national' as const, countryCode: 'nz' },
    // Group H
    { name: 'Zöld-foki Köztársaság', shortCode: 'CPV', group: 'H', teamType: 'national' as const, countryCode: 'cv' },
    { name: 'Szaúd-Arábia', shortCode: 'KSA', group: 'H', teamType: 'national' as const, countryCode: 'sa' },
    { name: 'Spanyolország', shortCode: 'ESP', group: 'H', teamType: 'national' as const, countryCode: 'es' },
    { name: 'Uruguay', shortCode: 'URU', group: 'H', teamType: 'national' as const, countryCode: 'uy' },
    // Group I
    { name: 'Franciaország', shortCode: 'FRA', group: 'I', teamType: 'national' as const, countryCode: 'fr' },
    { name: 'Irak', shortCode: 'IRQ', group: 'I', teamType: 'national' as const, countryCode: 'iq' },
    { name: 'Norvégia', shortCode: 'NOR', group: 'I', teamType: 'national' as const, countryCode: 'no' },
    { name: 'Szenegál', shortCode: 'SEN', group: 'I', teamType: 'national' as const, countryCode: 'sn' },
    // Group J
    { name: 'Algéria', shortCode: 'ALG', group: 'J', teamType: 'national' as const, countryCode: 'dz' },
    { name: 'Argentína', shortCode: 'ARG', group: 'J', teamType: 'national' as const, countryCode: 'ar' },
    { name: 'Ausztria', shortCode: 'AUT', group: 'J', teamType: 'national' as const, countryCode: 'at' },
    { name: 'Jordánia', shortCode: 'JOR', group: 'J', teamType: 'national' as const, countryCode: 'jo' },
    // Group K
    { name: 'Kolumbia', shortCode: 'COL', group: 'K', teamType: 'national' as const, countryCode: 'co' },
    { name: 'Kongói DK', shortCode: 'COD', group: 'K', teamType: 'national' as const, countryCode: 'cd' },
    { name: 'Portugália', shortCode: 'POR', group: 'K', teamType: 'national' as const, countryCode: 'pt' },
    { name: 'Üzbegisztán', shortCode: 'UZB', group: 'K', teamType: 'national' as const, countryCode: 'uz' },
    // Group L
    { name: 'Horvátország', shortCode: 'CRO', group: 'L', teamType: 'national' as const, countryCode: 'hr' },
    { name: 'Anglia', shortCode: 'ENG', group: 'L', teamType: 'national' as const, countryCode: 'gb-eng' },
    { name: 'Ghána', shortCode: 'GHA', group: 'L', teamType: 'national' as const, countryCode: 'gh' },
    { name: 'Panama', shortCode: 'PAN', group: 'L', teamType: 'national' as const, countryCode: 'pa' },
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

  // Pre-draw seed left teams in stale groups; null them before upsert.
  await db.update(teams).set({ group: null }).where(eq(teams.teamType, 'national'))

  for (const team of teamData) {
    await db.insert(teams).values(team).onConflictDoUpdate({
      target: teams.shortCode,
      set: {
        name: team.name,
        group: team.group,
        countryCode: team.countryCode,
        teamType: team.teamType,
        ...('flagUrl' in team ? { flagUrl: team.flagUrl } : {}),
        updatedAt: new Date(),
      },
    })
  }

  // ─── Leagues ────────────────────────────────────────────────────────────
  const leagueData = [
    { name: 'FIFA World Cup 2026', shortName: 'WC2026', startsAt: new Date('2026-06-11T18:00:00Z') },
    { name: 'NB I 2025/26', shortName: 'NB I', startsAt: null },
  ]

  for (const league of leagueData) {
    await db.insert(leagues).values(league).onConflictDoNothing()
  }
  // Backfill startsAt for the WC league when row already existed (idempotent).
  await db.update(leagues)
    .set({ startsAt: new Date('2026-06-11T18:00:00Z') })
    .where(eq(leagues.shortName, 'WC2026'))

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
