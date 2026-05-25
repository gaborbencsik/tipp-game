import type { RawMatchStats } from './stats.types.js'

export interface PromptInput {
  readonly homeTeamName: string
  readonly awayTeamName: string
  readonly stats: RawMatchStats
  readonly skipTypes?: readonly string[]
  readonly insightCount?: number
}

const VALID_TYPES = ['defense', 'attack', 'form', 'set_pieces', 'key_matchup', 'fatigue', 'historical'] as const

function summarizeTeam(name: string, t: RawMatchStats['homeTeam']): string {
  const recent = t.recentMatches.slice(0, 5).map(m =>
    `  - ${m.date} ${m.competition} vs ${m.opponent}: ${m.goalsFor}-${m.goalsAgainst} (${m.result})`
  ).join('\n')
  return `${name} (24-month window):
  matches=${t.totalMatches} W=${t.wins} D=${t.draws} L=${t.losses} winRate=${t.winRate.toFixed(2)}
  goals_scored=${t.goalsScored} (${t.goalsScoredPerMatch.toFixed(2)}/match)
  goals_conceded=${t.goalsConceded} (${t.goalsConcededPerMatch.toFixed(2)}/match)
  clean_sheets=${t.cleanSheets} (rate=${t.cleanSheetRate.toFixed(2)})
  recent_form="${t.formString}"
  last 5:\n${recent}`
}

export function buildInsightPrompt(input: PromptInput): string {
  const count = input.insightCount ?? 5
  const skip = input.skipTypes ?? []
  const allowedTypes = VALID_TYPES.filter(t => !skip.includes(t))

  return `You are a football statistics analyst. Generate ${count} concise, data-grounded pre-match insights for the upcoming match between ${input.homeTeamName} (home) and ${input.awayTeamName} (away).

DATA:
${summarizeTeam(input.homeTeamName, input.stats.homeTeam)}

${summarizeTeam(input.awayTeamName, input.stats.awayTeam)}

REQUIREMENTS:
- Output exactly ${count} insights, each with a different type from this allowed list: ${allowedTypes.join(', ')}.
- Each insight body must be 2-4 sentences, English, contain concrete numbers from the DATA above. Do NOT invent statistics.
- Title: max 80 characters, punchy.
- Body: max 400 characters.
- dataPoints keys MUST be english snake_case (e.g. home_goals_per_match, away_clean_sheets, win_rate). Values are numbers.
- Pick the ${count} most informative angles. Vary the types.

OUTPUT JSON ONLY, no markdown, no commentary. Schema:
{
  "insights": [
    {
      "type": "<one of: ${allowedTypes.join('|')}>",
      "title": "string (max 80 chars)",
      "body": "string (2-4 sentences, max 400 chars)",
      "dataPoints": { "snake_case_key": <number>, ... }
    }
  ]
}`
}
