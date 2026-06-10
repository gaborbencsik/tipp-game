import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db/client.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}))

import { parseMoneylineOdds, pruneOldSnapshots, SNAPSHOT_RETENTION_LIMIT } from '../src/services/polymarket.service.js'
import { db } from '../src/db/client.js'

const makeEvent = (markets: unknown[], competitive = 0.75, eventMetadata?: string) => ({
  id: 'test-id',
  slug: 'fifwc-fra-sen-2026-06-16',
  title: 'France vs Senegal',
  competitive,
  markets: markets as never[],
  eventMetadata,
})

describe('parseMoneylineOdds', () => {
  it('parses 3-way moneyline (home/draw/away)', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.55, 0.45]', bestBid: 0.54, bestAsk: 0.56, lastTradePrice: 0.55, volume: 10000, liquidity: '5000', oneDayPriceChange: 0.02, oneWeekPriceChange: 0.05 },
      { groupItemTitle: 'Draw', outcomePrices: '[0.25, 0.75]', bestBid: 0.24, bestAsk: 0.26, lastTradePrice: 0.25, volume: 3000, liquidity: '2000', oneDayPriceChange: -0.01, oneWeekPriceChange: 0.0 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.20, 0.80]', bestBid: 0.19, bestAsk: 0.21, lastTradePrice: 0.20, volume: 2000, liquidity: '1500', oneDayPriceChange: -0.01, oneWeekPriceChange: -0.05 },
    ])

    const result = parseMoneylineOdds(event, 'France', 'Senegal')
    expect(result).not.toBeNull()
    expect(result!.homeWin).toBe(0.55)
    expect(result!.draw).toBe(0.25)
    expect(result!.awayWin).toBe(0.20)
    expect(result!.oneDayChangeHome).toBe(0.02)
    expect(result!.oneDayChangeDraw).toBe(-0.01)
    expect(result!.oneDayChangeAway).toBe(-0.01)
    expect(result!.oneWeekChangeHome).toBe(0.05)
    expect(result!.marketVolume).toBe(15000)
    expect(result!.marketLiquidity).toBe(8500)
    expect(result!.bestBidHome).toBe(0.54)
    expect(result!.bestAskHome).toBe(0.56)
    expect(result!.lastTradePriceHome).toBe(0.55)
    expect(result!.competitive).toBe(0.75)
  })

  it('parses 2-way moneyline (no draw)', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.65, 0.35]', bestBid: 0.64, bestAsk: 0.66, lastTradePrice: 0.65, volume: 8000, liquidity: '4000', oneDayPriceChange: 0.03, oneWeekPriceChange: 0.1 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.35, 0.65]', bestBid: 0.34, bestAsk: 0.36, lastTradePrice: 0.35, volume: 4000, liquidity: '2000', oneDayPriceChange: -0.03, oneWeekPriceChange: -0.1 },
    ])

    const result = parseMoneylineOdds(event, 'France', 'Senegal')
    expect(result).not.toBeNull()
    expect(result!.homeWin).toBe(0.65)
    expect(result!.draw).toBeNull()
    expect(result!.awayWin).toBe(0.35)
  })

  it('returns null when fewer than 2 markets', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.65, 0.35]', bestBid: 0.64, bestAsk: 0.66, lastTradePrice: 0.65, volume: 8000, liquidity: '4000', oneDayPriceChange: 0.03, oneWeekPriceChange: 0.1 },
    ])
    expect(parseMoneylineOdds(event, 'France', 'Senegal')).toBeNull()
  })

  it('returns null when markets array is empty', () => {
    const event = makeEvent([])
    expect(parseMoneylineOdds(event, 'France', 'Senegal')).toBeNull()
  })

  it('parses context_description from eventMetadata', () => {
    const metadata = JSON.stringify({ context_description: 'France are strong favorites after qualifying top of their group.' })
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.55, 0.45]', bestBid: 0.54, bestAsk: 0.56, lastTradePrice: 0.55, volume: 10000, liquidity: '5000', oneDayPriceChange: 0.02, oneWeekPriceChange: 0.05 },
      { groupItemTitle: 'Draw', outcomePrices: '[0.25, 0.75]', bestBid: 0.24, bestAsk: 0.26, lastTradePrice: 0.25, volume: 3000, liquidity: '2000', oneDayPriceChange: -0.01, oneWeekPriceChange: 0.0 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.20, 0.80]', bestBid: 0.19, bestAsk: 0.21, lastTradePrice: 0.20, volume: 2000, liquidity: '1500', oneDayPriceChange: -0.01, oneWeekPriceChange: -0.05 },
    ], 0.8, metadata)

    const result = parseMoneylineOdds(event, 'France', 'Senegal')
    expect(result!.contextDescription).toBe('France are strong favorites after qualifying top of their group.')
  })

  it('handles invalid eventMetadata gracefully', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.55, 0.45]', bestBid: 0.54, bestAsk: 0.56, lastTradePrice: 0.55, volume: 10000, liquidity: '5000', oneDayPriceChange: 0.02, oneWeekPriceChange: 0.05 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.45, 0.55]', bestBid: 0.44, bestAsk: 0.46, lastTradePrice: 0.45, volume: 5000, liquidity: '3000', oneDayPriceChange: -0.02, oneWeekPriceChange: -0.05 },
    ], 0.9, 'not-valid-json')

    const result = parseMoneylineOdds(event, 'France', 'Senegal')
    expect(result!.contextDescription).toBeNull()
  })

  it('assigns odds by team name, not market order (away team is favorite)', () => {
    // Polymarket returns markets ordered by probability, not by home/away.
    // When the away team is favorite, it appears FIRST in the markets array.
    const event = makeEvent([
      { groupItemTitle: 'Senegal', outcomePrices: '[0.60, 0.40]', bestBid: 0.59, bestAsk: 0.61, lastTradePrice: 0.60, volume: 9000, liquidity: '4000', oneDayPriceChange: 0.04, oneWeekPriceChange: 0.08 },
      { groupItemTitle: 'Draw', outcomePrices: '[0.25, 0.75]', bestBid: 0.24, bestAsk: 0.26, lastTradePrice: 0.25, volume: 3000, liquidity: '2000', oneDayPriceChange: -0.01, oneWeekPriceChange: 0.0 },
      { groupItemTitle: 'France', outcomePrices: '[0.15, 0.85]', bestBid: 0.14, bestAsk: 0.16, lastTradePrice: 0.15, volume: 2000, liquidity: '1500', oneDayPriceChange: -0.03, oneWeekPriceChange: -0.08 },
    ])

    const result = parseMoneylineOdds(event, 'France', 'Senegal')
    expect(result).not.toBeNull()
    expect(result!.homeWin).toBe(0.15)
    expect(result!.awayWin).toBe(0.60)
    expect(result!.oneDayChangeHome).toBe(-0.03)
    expect(result!.oneDayChangeAway).toBe(0.04)
    expect(result!.bestBidHome).toBe(0.14)
    expect(result!.bestAskHome).toBe(0.16)
    expect(result!.lastTradePriceHome).toBe(0.15)
  })

  it('returns null when home or away team market cannot be matched by name', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.55, 0.45]', bestBid: 0.54, bestAsk: 0.56, lastTradePrice: 0.55, volume: 10000, liquidity: '5000', oneDayPriceChange: 0.02, oneWeekPriceChange: 0.05 },
      { groupItemTitle: 'Draw', outcomePrices: '[0.25, 0.75]', bestBid: 0.24, bestAsk: 0.26, lastTradePrice: 0.25, volume: 3000, liquidity: '2000', oneDayPriceChange: -0.01, oneWeekPriceChange: 0.0 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.20, 0.80]', bestBid: 0.19, bestAsk: 0.21, lastTradePrice: 0.20, volume: 2000, liquidity: '1500', oneDayPriceChange: -0.01, oneWeekPriceChange: -0.05 },
    ])

    expect(parseMoneylineOdds(event, 'France', 'Brazil')).toBeNull()
  })

  describe('team name aliases (DB name vs Polymarket groupItemTitle)', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['USA', 'United States'],
      ['South Korea', 'Korea Republic'],
      ['Czech Republic', 'Czechia'],
      ['Ivory Coast', "Côte d'Ivoire"],
      ['Cape Verde Islands', 'Cabo Verde'],
      ['Congo DR', 'DR Congo'],
      ['Bosnia & Herzegovina', 'Bosnia and Herzegovina'],
      ['Iran', 'IR Iran'],
    ]

    for (const [dbName, polyName] of cases) {
      it(`matches "${dbName}" (DB) ↔ "${polyName}" (Polymarket)`, () => {
        const event = makeEvent([
          { groupItemTitle: polyName, outcomePrices: '[0.60, 0.40]', bestBid: 0.59, bestAsk: 0.61, lastTradePrice: 0.60, volume: 9000, liquidity: '4000', oneDayPriceChange: 0.04, oneWeekPriceChange: 0.08 },
          { groupItemTitle: `Draw (${polyName} vs. Spain)`, outcomePrices: '[0.20, 0.80]', bestBid: 0.19, bestAsk: 0.21, lastTradePrice: 0.20, volume: 3000, liquidity: '2000', oneDayPriceChange: -0.01, oneWeekPriceChange: 0.0 },
          { groupItemTitle: 'Spain', outcomePrices: '[0.20, 0.80]', bestBid: 0.19, bestAsk: 0.21, lastTradePrice: 0.20, volume: 2000, liquidity: '1500', oneDayPriceChange: -0.03, oneWeekPriceChange: -0.08 },
        ])

        const result = parseMoneylineOdds(event, dbName, 'Spain')
        expect(result).not.toBeNull()
        expect(result!.homeWin).toBe(0.60)
        expect(result!.awayWin).toBe(0.20)
      })
    }
  })
})

describe('pruneOldSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes a default retention limit of 5', () => {
    expect(SNAPSHOT_RETENTION_LIMIT).toBe(5)
  })

  it('deletes snapshots beyond the retention limit for the given match', async () => {
    await pruneOldSnapshots('match-uuid-1')

    expect(db.execute).toHaveBeenCalledTimes(1)
    const sqlObj = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // Drizzle SQL objects expose queryChunks/values; serialize for content checks
    const serialized = JSON.stringify(sqlObj)
    expect(serialized).toContain('DELETE FROM match_market_data')
    expect(serialized).toContain('match-uuid-1')
    expect(serialized).toContain('ORDER BY fetched_at DESC')
    expect(serialized).toContain('5')
  })

  it('honors a custom limit override', async () => {
    await pruneOldSnapshots('match-uuid-2', 10)

    const sqlObj = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(JSON.stringify(sqlObj)).toContain('10')
  })

  it('scopes deletion to a single match (match_id appears in WHERE and subquery)', async () => {
    await pruneOldSnapshots('match-uuid-3')

    const sqlObj = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const serialized = JSON.stringify(sqlObj)
    // The match id must appear at least twice: outer WHERE + inner subquery
    const occurrences = serialized.split('match-uuid-3').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })
})
