import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { matches, matchMarketData, teams } from '../db/schema/index.js'
import { alias } from 'drizzle-orm/pg-core'

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com'

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
  readonly revealed: boolean
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
  const response = await fetch(url)
  if (!response.ok) return null
  const data = await response.json() as PolymarketEvent
  if (!data.markets || data.markets.length === 0) return null
  return data
}

export function parseMoneylineOdds(event: PolymarketEvent): ParsedOdds | null {
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

  for (const market of markets) {
    const title = market.groupItemTitle?.toLowerCase() ?? ''
    const prices = JSON.parse(market.outcomePrices) as number[]
    const yesPrice = prices[0] ?? 0

    totalVolume += parseFloat(String(market.volume ?? '0'))
    totalLiquidity += parseFloat(String(market.liquidity ?? '0'))

    if (title.includes('draw')) {
      draw = yesPrice
      oneDayChangeDraw = market.oneDayPriceChange ?? null
      oneWeekChangeDraw = market.oneWeekPriceChange ?? null
    } else if (homeWin === null) {
      homeWin = yesPrice
      oneDayChangeHome = market.oneDayPriceChange ?? null
      oneWeekChangeHome = market.oneWeekPriceChange ?? null
      bestBidHome = market.bestBid ?? null
      bestAskHome = market.bestAsk ?? null
      lastTradePriceHome = market.lastTradePrice ?? null
    } else {
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
  const matchesWithSlug = await db
    .select({
      id: matches.id,
      polymarketSlug: matches.polymarketSlug,
    })
    .from(matches)
    .where(isNotNull(matches.polymarketSlug))

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const match of matchesWithSlug) {
    try {
      const event = await fetchEventBySlug(match.polymarketSlug!)
      if (!event) { failed++; errors.push(`${match.polymarketSlug}: no event found`); continue }

      const odds = parseMoneylineOdds(event)
      if (!odds) { failed++; errors.push(`${match.polymarketSlug}: could not parse moneyline`); continue }

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
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${match.polymarketSlug}: ${msg}`)
    }
  }

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
    revealed: false,
  }
}
