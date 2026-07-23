import { describe, it, expect } from 'vitest'
import { buildPredictionsCsv, predictionsCsvFilename } from './predictionsCsv'
import type { Match, MatchPrediction } from '../types/index.js'

const match = {
  id: 'm1',
  homeTeam: { id: 'h', name: 'Magyarország', shortCode: 'HUN', flagUrl: null, teamType: 'national', countryCode: 'HU', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'a', name: 'Németország', shortCode: 'GER', flagUrl: null, teamType: 'national', countryCode: 'DE', marketValueEur: null, transfermarktId: null },
  venue: null,
  league: null,
  stage: 'final',
  groupName: null,
  matchNumber: null,
  scheduledAt: '2026-07-23T18:00:00.000Z',
  status: 'finished',
  result: null,
} as unknown as Match

function pred(overrides: Partial<MatchPrediction> = {}): MatchPrediction {
  return {
    userId: 'u1',
    displayName: 'Anna',
    homeGoals: 2,
    awayGoals: 1,
    outcomeAfterDraw: null,
    pointsGlobal: null,
    pointsResult: 3,
    scorerPickPlayerId: null,
    scorerPlayerNameSnapshot: 'Szoboszlai',
    scorerBonusPoints: 2,
    isSupporter: true,
    ...overrides,
  }
}

const BOM = '﻿'

describe('buildPredictionsCsv', () => {
  it('empty list → BOM + header row only', () => {
    const csv = buildPredictionsCsv([], match)
    const lines = csv.split('\n')
    expect(csv.startsWith(BOM)).toBe(true)
    expect(lines[0]).toBe(`${BOM}Felhasználónév,Tippelt eredmény,Gólszerző,Meccs pont,Gólszerző bónusz`)
    expect(lines[1]).toBe('')
    expect(lines).toHaveLength(2)
  })

  it('single prediction → header + one data row', () => {
    const csv = buildPredictionsCsv([pred()], match)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('Anna,2-1,Szoboszlai,3,2')
  })

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csv = buildPredictionsCsv([pred({ displayName: 'Kiss, "Béla"\nJr' })], match)
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"Kiss, ""Béla""')
  })

  it('null pointsResult → "–", zero → "0"', () => {
    expect(buildPredictionsCsv([pred({ pointsResult: null })], match).split('\n')[1]).toContain(',–,')
    expect(buildPredictionsCsv([pred({ pointsResult: 0 })], match).split('\n')[1]).toContain(',0,')
  })

  it('null scorerBonusPoints or 0 → "–"', () => {
    expect(buildPredictionsCsv([pred({ scorerBonusPoints: null })], match).split('\n')[1].split(',').at(-1)).toBe('–')
    expect(buildPredictionsCsv([pred({ scorerBonusPoints: 0 })], match).split('\n')[1].split(',').at(-1)).toBe('–')
  })

  it('null scorer → empty cell', () => {
    expect(buildPredictionsCsv([pred({ scorerPlayerNameSnapshot: null })], match).split('\n')[1]).toBe('Anna,2-1,,3,2')
  })

  it('starts with the UTF-8 BOM', () => {
    expect(buildPredictionsCsv([], match).charCodeAt(0)).toBe(0xfeff)
  })
})

describe('predictionsCsvFilename', () => {
  it('builds tippek-<home>-<away>-<date>.csv from short codes and scheduled date', () => {
    expect(predictionsCsvFilename(match)).toBe('tippek-HUN-GER-2026-07-23.csv')
  })
})
