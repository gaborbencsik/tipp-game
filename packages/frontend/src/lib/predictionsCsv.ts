import type { Match, MatchPrediction } from '../types/index.js'

const UTF8_BOM = '﻿'

const HEADERS: readonly string[] = [
  'Felhasználónév',
  'Tippelt eredmény',
  'Gólszerző',
  'Meccs pont',
  'Gólszerző bónusz',
]

function escapeCsv(cell: string): string {
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}

function toRow(p: MatchPrediction): string {
  const cells: readonly string[] = [
    p.displayName,
    `${p.homeGoals}-${p.awayGoals}`,
    p.scorerPlayerNameSnapshot ?? '',
    p.pointsResult === null ? '–' : String(p.pointsResult),
    p.scorerBonusPoints ? String(p.scorerBonusPoints) : '–',
  ]
  return cells.map(escapeCsv).join(',')
}

export function buildPredictionsCsv(predictions: readonly MatchPrediction[], _match: Match): string {
  const rows = [HEADERS.map(escapeCsv).join(','), ...predictions.map(toRow)]
  return UTF8_BOM + rows.join('\n') + '\n'
}

export function predictionsCsvFilename(match: Match): string {
  const date = match.scheduledAt.slice(0, 10)
  return `tippek-${match.homeTeam.shortCode}-${match.awayTeam.shortCode}-${date}.csv`
}
