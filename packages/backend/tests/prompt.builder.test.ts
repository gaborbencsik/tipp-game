import { describe, it, expect } from 'vitest'
import { buildInsightPrompt } from '../src/services/insights/prompt.builder.js'
import type { RawMatchStats } from '../src/services/insights/stats.types.js'

const STATS: RawMatchStats = {
  homeTeam: {
    externalId: 25,
    totalMatches: 30,
    wins: 18,
    draws: 7,
    losses: 5,
    winRate: 0.6,
    goalsScored: 65,
    goalsScoredPerMatch: 2.17,
    goalsConceded: 22,
    goalsConcededPerMatch: 0.73,
    cleanSheets: 12,
    cleanSheetRate: 0.4,
    formString: 'WWDLW',
    recentMatches: [
      { date: '2026-03-25', competition: 'Friendly', opponent: 'Italy', goalsFor: 2, goalsAgainst: 1, result: 'W' },
    ],
  },
  awayTeam: {
    externalId: 7,
    totalMatches: 28,
    wins: 16,
    draws: 6,
    losses: 6,
    winRate: 0.57,
    goalsScored: 50,
    goalsScoredPerMatch: 1.79,
    goalsConceded: 25,
    goalsConcededPerMatch: 0.89,
    cleanSheets: 9,
    cleanSheetRate: 0.32,
    formString: 'WLWDW',
    recentMatches: [],
  },
}

describe('prompt.builder', () => {
  it('includes both team names and goal stats', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
    })
    expect(prompt).toContain('Germany')
    expect(prompt).toContain('Spain')
    expect(prompt).toContain('2.17')
    expect(prompt).toContain('0.89')
  })

  it('requests exactly 5 insights by default', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
    })
    expect(prompt).toMatch(/exactly 5 insights/)
  })

  it('excludes skipped types from allowed list', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
      skipTypes: ['defense', 'fatigue'],
      insightCount: 3,
    })
    expect(prompt).toMatch(/exactly 3 insights/)
    expect(prompt).not.toMatch(/allowed list:[^\n]*defense/)
    expect(prompt).not.toMatch(/allowed list:[^\n]*fatigue/)
    expect(prompt).toMatch(/allowed list:[^\n]*attack/)
  })

  it('demands snake_case dataPoints keys', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
    })
    expect(prompt).toMatch(/snake_case/)
  })

  it('demands JSON-only output (no markdown)', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
    })
    expect(prompt).toMatch(/JSON ONLY/)
    expect(prompt).toMatch(/no markdown/)
  })

  it('includes a TYPE DEFINITIONS section that disambiguates form vs historical', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
    })
    expect(prompt).toMatch(/TYPE DEFINITIONS/)
    expect(prompt).toMatch(/form:\s+SHORT-TERM momentum/)
    expect(prompt).toMatch(/historical:\s+long-window patterns/)
    expect(prompt).toMatch(/head-to-head/i)
  })

  it('forbids overlapping metrics across insights', () => {
    const prompt = buildInsightPrompt({
      homeTeamName: 'Germany',
      awayTeamName: 'Spain',
      stats: STATS,
    })
    expect(prompt).toMatch(/DIFFERENT analytical lens/)
    expect(prompt).toMatch(/no two insights may rely on the same underlying metric/i)
    expect(prompt).toMatch(/do NOT use win_rate or 24-month totals in both 'form' and 'historical'/)
  })
})
