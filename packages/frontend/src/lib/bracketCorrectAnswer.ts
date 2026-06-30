import type { BracketProgressionCorrectAnswer } from '../types/index.js'

/**
 * UX-044: round handle used in the admin BracketRoundTeamList. Distinct from `BracketRound`
 * (the match-level round enum, which includes `bronze` but not `champion`): the admin UI
 * adds a separate "Champion" section because it is a single-team pick from `final`.
 */
export type AdminCorrectAnswerRound =
  | 'last_32' | 'last_16' | 'qf' | 'sf' | 'final' | 'champion' | 'bronze'

const PARTICIPANT_ROUNDS = ['last_32', 'last_16', 'qf', 'sf', 'final'] as const
type ParticipantRound = (typeof PARTICIPANT_ROUNDS)[number]

function isParticipantRound(round: AdminCorrectAnswerRound): round is ParticipantRound {
  return (PARTICIPANT_ROUNDS as readonly string[]).includes(round)
}

export function emptyCorrectAnswer(): BracketProgressionCorrectAnswer {
  return {
    participants: { last_32: [], last_16: [], qf: [], sf: [], final: [] },
    champion: null,
    bronzeWinner: null,
  }
}

/**
 * Build a new `BracketProgressionCorrectAnswer` by updating exactly one round of the admin's
 * pyramid pick. Downstream rounds are auto-cleared when they would otherwise contain teams
 * that are no longer part of the just-updated upstream pool.
 *
 * Rounds in order of containment (each subset of the previous):
 *   last_32 ⊇ last_16 ⊇ qf ⊇ sf ⊇ final
 *   champion ∈ final
 *   bronzeWinner ∈ sf \ final
 */
export function buildCorrectAnswer(
  round: AdminCorrectAnswerRound,
  selectedTeamIds: readonly string[],
  prev: BracketProgressionCorrectAnswer | null,
): BracketProgressionCorrectAnswer {
  const base = prev ?? emptyCorrectAnswer()

  if (round === 'champion') {
    const next = selectedTeamIds.length > 0 ? selectedTeamIds[0] : null
    return { ...base, champion: next }
  }

  if (round === 'bronze') {
    const next = selectedTeamIds.length > 0 ? selectedTeamIds[0] : null
    return { ...base, bronzeWinner: next }
  }

  if (!isParticipantRound(round)) {
    return base
  }

  const updatedParticipants = { ...base.participants, [round]: [...selectedTeamIds] }
  let champion = base.champion
  let bronzeWinner = base.bronzeWinner

  // Cascade: any downstream round whose teams are no longer ⊆ the new round must be cleared.
  // Champion ∈ final and bronzeWinner ∈ sf are also dropped when their anchor sets shift.
  const downstream: readonly ParticipantRound[] = downstreamRounds(round)
  let parentSet = new Set(updatedParticipants[round])
  for (const child of downstream) {
    const childList = updatedParticipants[child]
    const stillValid = childList.every(t => parentSet.has(t))
    if (!stillValid) {
      updatedParticipants[child] = []
      parentSet = new Set<string>()
    } else {
      parentSet = new Set(childList)
    }
  }

  if (updatedParticipants.final.length === 0 || (champion !== null && !updatedParticipants.final.includes(champion))) {
    champion = updatedParticipants.final.includes(champion ?? '') ? champion : null
  }
  if (bronzeWinner !== null) {
    const sfSet = new Set(updatedParticipants.sf)
    const finalSet = new Set(updatedParticipants.final)
    if (!sfSet.has(bronzeWinner) || finalSet.has(bronzeWinner)) bronzeWinner = null
  }

  return { participants: updatedParticipants, champion, bronzeWinner }
}

function downstreamRounds(round: ParticipantRound): readonly ParticipantRound[] {
  const idx = PARTICIPANT_ROUNDS.indexOf(round)
  return PARTICIPANT_ROUNDS.slice(idx + 1)
}
