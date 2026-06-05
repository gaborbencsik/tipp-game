import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { matches, matchMarketData, teams } from '../db/schema/index.js'
import { alias } from 'drizzle-orm/pg-core'
import { createLogger } from './logger.service.js'

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'
const USER_AGENT = 'tipp-game/1.0 (+https://github.com/gbencsik/tipp-game)'
const REQUEST_DELAY_MS = 150

const logger = createLogger('polymarket')

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface MarketSide {
  readonly label: string
  readonly price: number
}

interface PolymarketMarket {
  readonly groupItemTitle: string
  readonly outcomePrices: string
  readonly bestBid: number
  readonly bestAsk: number
  readonly lastTradePrice: number
  readonly volume: string | number
  readonly liquidity: string
  readonly oneDayPriceChange: number
  readonly oneWeekPriceChange: number
}

interface PolymarketEvent {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly competitive: number
  readonly markets: PolymarketMarket[]
  readonly eventMetadata?: string
}

export interface MatchOddsResponse {
  readonly homeTeam: { readonly name: string; readonly odds: number }
  readonly draw: number | null
  readonly awayTeam: { readonly name: string; readonly odds: number }
  readonly oneDayChange: { readonly home: number | null; readonly draw: number | null; readonly away: number | null }
  readonly volume: number | null
  readonly avgVolume: number | null
  readonly competitive: number | null
  readonly contextDescription: string | null
  readonly source: 'polymarket'
  readonly sourceUrl: string | null
  readonly updatedAt: string
}

interface ParsedOdds {
  readonly homeWin: number
  readonly draw: number | null
  readonly awayWin: number
  readonly oneDayChangeHome: number | null
  readonly oneDayChangeDraw: number | null
  readonly oneDayChangeAway: number | null
  readonly oneWeekChangeHome: number | null
  readonly oneWeekChangeDraw: number | null
  readonly oneWeekChangeAway: number | null
  readonly marketVolume: number | null
  readonly marketLiquidity: number | null
  readonly bestBidHome: number | null
  readonly bestAskHome: number | null
  readonly lastTradePriceHome: number | null
  readonly competitive: number | null
  readonly contextDescription: string | null
}

export async function fetchEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  const url = `${GAMMA_API_BASE}/events/slug/${slug}`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, accept: 'application/json' } })
  if (!response.ok) {
    logger.warn('fetch failed', { slug, status: response.status, statusText: response.statusText })
    return null
  }
  const data = await response.json() as PolymarketEvent
  if (!data.markets || data.markets.length === 0) {
    logger.warn('no markets in event', { slug, eventId: data.id })
    return null
  }
  return data
}

// Map DB team names to their canonical form. Polymarket uses different
// spellings (e.g. "United States" vs "USA"); after normalization both sides
// must reduce to the same key. Keys and values are stored lowercased and
// pre-normalized (diacritics stripped, "&"→"and", non-alnum stripped).
const TEAM_NAME_ALIASES: Readonly<Record<string, string>> = {
  // DB form (normalized) → canonical key
  'usa': 'unitedstates',
  'us': 'unitedstates',
  'unitedstates': 'unitedstates',
  'southkorea': 'korea',
  'korearepublic': 'korea',
  'korea': 'korea',
  'czechrepublic': 'czechia',
  'czechia': 'czechia',
  'ivorycoast': 'cotedivoire',
  'cotedivoire': 'cotedivoire',
  'capeverdeislands': 'caboverde',
  'capeverde': 'caboverde',
  'caboverde': 'caboverde',
  'congodr': 'drcongo',
  'drcongo': 'drcongo',
  'democraticrepublicofthecongo': 'drcongo',
  'bosniaandherzegovina': 'bosnia',
  'bosniaherzegovina': 'bosnia',
  'bosnia': 'bosnia',
  'iran': 'iran',
  'iriran': 'iran',
  'islamicrepublicofiran': 'iran',
}

function normalizeTeamName(raw: string): string {
  const stripped = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
  return TEAM_NAME_ALIASES[stripped] ?? stripped
}

export function parseMoneylineOdds(
  event: PolymarketEvent,
  homeTeamName: string,
  awayTeamName: string,
): ParsedOdds | null {
  const markets = event.markets
  if (!markets || markets.length < 2) return null

  let homeWin: number | null = null
  let draw: number | null = null
  let awayWin: number | null = null
  let oneDayChangeHome: number | null = null
  let oneDayChangeDraw: number | null = null
  let oneDayChangeAway: number | null = null
  let oneWeekChangeHome: number | null = null
  let oneWeekChangeDraw: number | null = null
  let oneWeekChangeAway: number | null = null
  let bestBidHome: number | null = null
  let bestAskHome: number | null = null
  let lastTradePriceHome: number | null = null
  let totalVolume = 0
  let totalLiquidity = 0

  const homeKey = normalizeTeamName(homeTeamName)
  const awayKey = normalizeTeamName(awayTeamName)

  for (const market of markets) {
    const rawTitle = market.groupItemTitle ?? ''
    const lowerTitle = rawTitle.toLowerCase()
    const titleKey = normalizeTeamName(rawTitle)
    const prices = JSON.parse(market.outcomePrices) as number[]
    const yesPrice = prices[0] ?? 0

    totalVolume += parseFloat(String(market.volume ?? '0'))
    totalLiquidity += parseFloat(String(market.liquidity ?? '0'))

    if (lowerTitle.includes('draw')) {
      draw = yesPrice
      oneDayChangeDraw = market.oneDayPriceChange ?? null
      oneWeekChangeDraw = market.oneWeekPriceChange ?? null
    } else if (titleKey === homeKey) {
      homeWin = yesPrice
      oneDayChangeHome = market.oneDayPriceChange ?? null
      oneWeekChangeHome = market.oneWeekPriceChange ?? null
      bestBidHome = market.bestBid ?? null
      bestAskHome = market.bestAsk ?? null
      lastTradePriceHome = market.lastTradePrice ?? null
    } else if (titleKey === awayKey) {
      awayWin = yesPrice
      oneDayChangeAway = market.oneDayPriceChange ?? null
      oneWeekChangeAway = market.oneWeekPriceChange ?? null
    }
  }

  if (homeWin === null || awayWin === null) return null

  let contextDescription: string | null = null
  if (event.eventMetadata) {
    try {
      const meta = JSON.parse(event.eventMetadata) as { context_description?: string }
      contextDescription = meta.context_description ?? null
    } catch {
      // ignore parse errors
    }
  }

  return {
    homeWin,
    draw,
    awayWin,
    oneDayChangeHome,
    oneDayChangeDraw,
    oneDayChangeAway,
    oneWeekChangeHome,
    oneWeekChangeDraw,
    oneWeekChangeAway,
    marketVolume: totalVolume || null,
    marketLiquidity: totalLiquidity || null,
    bestBidHome,
    bestAskHome,
    lastTradePriceHome,
    competitive: event.competitive ?? null,
    contextDescription,
  }
}

export async function syncAllMatchOdds(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')

  const matchesWithSlug = await db
    .select({
      id: matches.id,
      polymarketSlug: matches.polymarketSlug,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
    })
    .from(matches)
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(isNotNull(matches.polymarketSlug))

  let synced = 0
  let failed = 0
  const errors: string[] = []

  logger.info('sync started', { totalMatches: matchesWithSlug.length })

  for (const match of matchesWithSlug) {
    const slug = match.polymarketSlug!
    const matchScope = { slug, matchId: match.id, home: match.homeTeamName, away: match.awayTeamName }
    try {
      const event = await fetchEventBySlug(slug)
      if (!event) {
        failed++
        const reason = 'no event found'
        errors.push(`${slug}: ${reason}`)
        logger.warn('match sync failed', { ...matchScope, reason })
        await delay(REQUEST_DELAY_MS)
        continue
      }

      const odds = parseMoneylineOdds(event, match.homeTeamName, match.awayTeamName)
      if (!odds) {
        failed++
        const marketTitles = event.markets.map((m) => m.groupItemTitle)
        const reason = 'could not parse moneyline (team name mismatch?)'
        errors.push(`${slug}: ${reason}`)
        logger.warn('match sync failed', { ...matchScope, reason, marketTitles })
        await delay(REQUEST_DELAY_MS)
        continue
      }

      await db.insert(matchMarketData).values({
        matchId: match.id,
        source: 'polymarket',
        homeWin: odds.homeWin,
        draw: odds.draw,
        awayWin: odds.awayWin,
        oneDayChangeHome: odds.oneDayChangeHome,
        oneDayChangeDraw: odds.oneDayChangeDraw,
        oneDayChangeAway: odds.oneDayChangeAway,
        oneWeekChangeHome: odds.oneWeekChangeHome,
        oneWeekChangeDraw: odds.oneWeekChangeDraw,
        oneWeekChangeAway: odds.oneWeekChangeAway,
        marketVolume: odds.marketVolume,
        marketLiquidity: odds.marketLiquidity,
        bestBidHome: odds.bestBidHome,
        bestAskHome: odds.bestAskHome,
        lastTradePriceHome: odds.lastTradePriceHome,
        competitive: odds.competitive,
        contextDescription: odds.contextDescription,
        rawPayload: event,
      })
      synced++
      logger.info('match synced', { ...matchScope, homeWin: odds.homeWin, draw: odds.draw, awayWin: odds.awayWin })
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${slug}: ${msg}`)
      logger.error('match sync error', { ...matchScope, error: msg })
    }
    await delay(REQUEST_DELAY_MS)
  }

  logger.info('sync finished', { synced, failed, total: matchesWithSlug.length })

  return { synced, failed, errors }
}

export async function getLatestOdds(matchId: string): Promise<MatchOddsResponse | null> {
  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')

  const rows = await db
    .select({
      homeWin: matchMarketData.homeWin,
      draw: matchMarketData.draw,
      awayWin: matchMarketData.awayWin,
      oneDayChangeHome: matchMarketData.oneDayChangeHome,
      oneDayChangeDraw: matchMarketData.oneDayChangeDraw,
      oneDayChangeAway: matchMarketData.oneDayChangeAway,
      marketVolume: matchMarketData.marketVolume,
      competitive: matchMarketData.competitive,
      contextDescription: matchMarketData.contextDescription,
      fetchedAt: matchMarketData.fetchedAt,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      polymarketSlug: matches.polymarketSlug,
      matchStage: matches.stage,
    })
    .from(matchMarketData)
    .innerJoin(matches, eq(matchMarketData.matchId, matches.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
    .where(eq(matchMarketData.matchId, matchId))
    .orderBy(desc(matchMarketData.fetchedAt))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const isGroup = row.matchStage === 'group'
  const stageFilter = isGroup
    ? sql.raw(`m2.stage = 'group'`)
    : sql.raw(`m2.stage != 'group'`)

  const medianResult = await db.execute(sql`
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mmd.market_volume) AS median
    FROM (
      SELECT DISTINCT ON (mmd2.match_id) mmd2.match_id, mmd2.market_volume
      FROM match_market_data mmd2
      JOIN matches m2 ON m2.id = mmd2.match_id
      WHERE ${stageFilter} AND mmd2.market_volume IS NOT NULL
      ORDER BY mmd2.match_id, mmd2.fetched_at DESC
    ) mmd
  `)

  const medianVolume = medianResult.rows[0]?.median
    ? parseFloat(String(medianResult.rows[0].median))
    : null

  const sourceUrl = row.polymarketSlug
    ? `https://polymarket.com/sports/fifa-world-cup/${row.polymarketSlug}`
    : null

  return {
    homeTeam: { name: row.homeTeamName, odds: row.homeWin },
    draw: row.draw,
    awayTeam: { name: row.awayTeamName, odds: row.awayWin },
    oneDayChange: {
      home: row.oneDayChangeHome,
      draw: row.oneDayChangeDraw,
      away: row.oneDayChangeAway,
    },
    volume: row.marketVolume,
    avgVolume: medianVolume,
    competitive: row.competitive,
    contextDescription: row.contextDescription,
    source: 'polymarket',
    sourceUrl,
    updatedAt: row.fetchedAt.toISOString(),
  }
}
