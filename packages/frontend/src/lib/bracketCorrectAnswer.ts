import type {
  BracketProgressionCorrectAnswer,
  BracketProgressionParticipants,
} from '../types/index.js'

export type AdminCorrectAnswerRound =
  | 'last_32' | 'last_16' | 'qf' | 'sf' | 'final' | 'champion' | 'bronze'

const TARGET_COUNT: Record<AdminCorrectAnswerRound, number> = {
  last_32: 32,
  last_16: 16,
  qf: 8,
  sf: 4,
  final: 2,
  champion: 1,
  bronze: 1,
}

export const ADMIN_ROUND_ORDER: readonly AdminCorrectAnswerRound[] = [
  'last_32', 'last_16', 'qf', 'sf', 'final', 'champion', 'bronze',
]

export function adminRoundTargetCount(round: AdminCorrectAnswerRound): number {
  return TARGET_COUNT[round]
}

const VALID_ROUNDS: ReadonlySet<AdminCorrectAnswerRound> = new Set([
  'last_32', 'last_16', 'qf', 'sf', 'final', 'champion', 'bronze',
])

export function emptyCorrectAnswer(): BracketProgressionCorrectAnswer {
  return {
    participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
    champion: null,
    bronzeWinner: null,
  }
}

/**
 * Parse the participants-shape JSON. Returns null if the input isn't a participants-shape
 * payload (e.g. it's a legacy winners-map or malformed). Callers can then fall back to
 * `emptyCorrectAnswer()` to start fresh.
 */
export function parseBracketProgressionCorrectAnswer(
  json: string,
): BracketProgressionCorrectAnswer | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const root = parsed as Record<string, unknown>
  const participantsRaw = root.participants
  if (typeof participantsRaw !== 'object' || participantsRaw === null || Array.isArray(participantsRaw)) return null
  const p = participantsRaw as Record<string, unknown>
  const roundKeys: readonly (keyof BracketProgressionParticipants)[] = ['last_32', 'last_16', 'qf', 'sf', 'final']
  const collected: Record<string, string[]> = {}
  for (const key of roundKeys) {
    const arr = p[key]
    if (!Array.isArray(arr)) return null
    const strs: string[] = []
    for (const v of arr) {
      if (typeof v !== 'string') return null
      strs.push(v)
    }
    collected[key] = strs
  }
  const champion = root.champion
  const bronzeWinner = root.bronzeWinner
  if (champion !== null && typeof champion !== 'string') return null
  if (bronzeWinner !== null && typeof bronzeWinner !== 'string') return null
  return {
    participants: {
      last_32: collected.last_32,
      last_16: collected.last_16,
      qf: collected.qf,
      sf: collected.sf,
      final: collected.final,
    },
    champion: champion as string | null,
    bronzeWinner: bronzeWinner as string | null,
  }
}

function poolFor(
  round: AdminCorrectAnswerRound,
  current: BracketProgressionCorrectAnswer | null,
): readonly string[] | null {
  // null pool = "no upstream constraint" (last_32 — the full team list lives outside this helper).
  if (round === 'last_32') return null
  if (!current) return []
  const p = current.participants
  if (round === 'last_16') return p.last_32
  if (round === 'qf') return p.last_16
  if (round === 'sf') return p.qf
  if (round === 'final') return p.sf
  if (round === 'champion') return p.final
  // bronze: SF participants minus the two finalists.
  const finalSet = new Set(p.final)
  return p.sf.filter(id => !finalSet.has(id))
}

export function buildCorrectAnswer(
  round: AdminCorrectAnswerRound,
  picks: readonly string[],
  current: BracketProgressionCorrectAnswer | null,
): BracketProgressionCorrectAnswer {
  if (!VALID_ROUNDS.has(round)) {
    throw new Error(`Unknown round: ${String(round)}`)
  }

  const target = TARGET_COUNT[round]
  if (picks.length !== 0 && picks.length !== target) {
    throw new Error(`${round} requires exactly ${target} team(s), got ${picks.length}`)
  }

  // Enforce subset-of-pool when picks are non-empty.
  const pool = poolFor(round, current)
  if (picks.length > 0 && pool !== null) {
    const poolSet = new Set(pool)
    for (const id of picks) {
      if (!poolSet.has(id)) {
        throw new Error(`Team ${id} not in pool for ${round}`)
      }
    }
  }

  // Start from the current state (or empty), construct a fresh participants object so
  // the readonly `BracketProgressionParticipants` shape is preserved.
  const base = current ?? emptyCorrectAnswer()
  const p = base.participants
  let last_32 = p.last_32
  let last_16 = p.last_16
  let qf = p.qf
  let sf = p.sf
  let finalParticipants = p.final
  let champion = base.champion
  let bronzeWinner = base.bronzeWinner

  if (round === 'last_32') {
    last_32 = [...picks]
    // Trim downstream — any pick downstream may now refer to a team no longer in last_32.
    last_16 = []
    qf = []
    sf = []
    finalParticipants = []
    champion = null
    bronzeWinner = null
  } else if (round === 'last_16') {
    last_16 = [...picks]
    qf = []
    sf = []
    finalParticipants = []
    champion = null
    bronzeWinner = null
  } else if (round === 'qf') {
    qf = [...picks]
    sf = []
    finalParticipants = []
    champion = null
    bronzeWinner = null
  } else if (round === 'sf') {
    sf = [...picks]
    finalParticipants = []
    champion = null
    bronzeWinner = null
  } else if (round === 'final') {
    finalParticipants = [...picks]
    champion = null
    // Bronze pool depends on `sf \ final` — re-validate the existing bronze pick against
    // the new final set; if it's no longer eligible (a finalist now), clear it.
    if (bronzeWinner !== null) {
      const finalSet = new Set(picks)
      if (finalSet.has(bronzeWinner)) bronzeWinner = null
    }
  } else if (round === 'champion') {
    champion = picks.length === 1 ? picks[0] : null
  } else if (round === 'bronze') {
    bronzeWinner = picks.length === 1 ? picks[0] : null
  }

  const participants: BracketProgressionParticipants = {
    last_32, last_16, qf, sf, final: finalParticipants,
  }
  return { participants, champion, bronzeWinner }
}
