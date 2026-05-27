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

TYPE DEFINITIONS (use these strictly — do NOT overlap angles between insights):
- attack:      offensive output (goals scored, scoring rate, attacking efficiency)
- defense:     defensive solidity (goals conceded, clean sheets, conceded rate)
- form:        SHORT-TERM momentum — last 5 results, formString, recent trend (NOT 24-month totals)
- historical:  long-window patterns the form lens cannot capture — head-to-head meetings between THESE two teams in recent_matches, biggest wins/losses, longest unbeaten or winless streaks, or notable opponent-quality patterns. If no past meeting between the two teams exists in the data, focus on streaks or extreme results — NEVER restate the 24-month win-rate or totals that 'form' already covers.
- key_matchup: the pivotal tactical or stylistic clash that decides the game
- set_pieces:  set-piece related angle (only if data supports it)
- fatigue:     scheduling / workload angle (only if data supports it)

REQUIREMENTS:
- Output exactly ${count} insights, each with a different type from this allowed list: ${allowedTypes.join(', ')}.
- Each insight body must be 2-4 sentences, English, contain concrete numbers from the DATA above. Do NOT invent statistics.
- Title: max 80 characters, punchy.
- Body: max 400 characters.
- dataPoints keys MUST be english snake_case (e.g. home_goals_per_match, away_clean_sheets, win_rate). Values are numbers.
- Pick the ${count} most informative angles. Vary the types.
- Each insight must occupy a DIFFERENT analytical lens — no two insights may rely on the same underlying metric (e.g. do NOT use win_rate or 24-month totals in both 'form' and 'historical').

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
