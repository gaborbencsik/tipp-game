import { describe, it, expect } from 'vitest'
import { parseMoneylineOdds } from '../src/services/polymarket.service.js'

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

    const result = parseMoneylineOdds(event)
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

    const result = parseMoneylineOdds(event)
    expect(result).not.toBeNull()
    expect(result!.homeWin).toBe(0.65)
    expect(result!.draw).toBeNull()
    expect(result!.awayWin).toBe(0.35)
  })

  it('returns null when fewer than 2 markets', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.65, 0.35]', bestBid: 0.64, bestAsk: 0.66, lastTradePrice: 0.65, volume: 8000, liquidity: '4000', oneDayPriceChange: 0.03, oneWeekPriceChange: 0.1 },
    ])
    expect(parseMoneylineOdds(event)).toBeNull()
  })

  it('returns null when markets array is empty', () => {
    const event = makeEvent([])
    expect(parseMoneylineOdds(event)).toBeNull()
  })

  it('parses context_description from eventMetadata', () => {
    const metadata = JSON.stringify({ context_description: 'France are strong favorites after qualifying top of their group.' })
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.55, 0.45]', bestBid: 0.54, bestAsk: 0.56, lastTradePrice: 0.55, volume: 10000, liquidity: '5000', oneDayPriceChange: 0.02, oneWeekPriceChange: 0.05 },
      { groupItemTitle: 'Draw', outcomePrices: '[0.25, 0.75]', bestBid: 0.24, bestAsk: 0.26, lastTradePrice: 0.25, volume: 3000, liquidity: '2000', oneDayPriceChange: -0.01, oneWeekPriceChange: 0.0 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.20, 0.80]', bestBid: 0.19, bestAsk: 0.21, lastTradePrice: 0.20, volume: 2000, liquidity: '1500', oneDayPriceChange: -0.01, oneWeekPriceChange: -0.05 },
    ], 0.8, metadata)

    const result = parseMoneylineOdds(event)
    expect(result!.contextDescription).toBe('France are strong favorites after qualifying top of their group.')
  })

  it('handles invalid eventMetadata gracefully', () => {
    const event = makeEvent([
      { groupItemTitle: 'France', outcomePrices: '[0.55, 0.45]', bestBid: 0.54, bestAsk: 0.56, lastTradePrice: 0.55, volume: 10000, liquidity: '5000', oneDayPriceChange: 0.02, oneWeekPriceChange: 0.05 },
      { groupItemTitle: 'Senegal', outcomePrices: '[0.45, 0.55]', bestBid: 0.44, bestAsk: 0.46, lastTradePrice: 0.45, volume: 5000, liquidity: '3000', oneDayPriceChange: -0.02, oneWeekPriceChange: -0.05 },
    ], 0.9, 'not-valid-json')

    const result = parseMoneylineOdds(event)
    expect(result!.contextDescription).toBeNull()
  })
})
