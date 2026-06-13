import { describe, it, expect } from 'vitest'
import {
  scoreGroup,
  scoreAllGroupsStanding,
  isValidGroupSlice,
} from '../src/services/tournament-scoring.service.js'
import { TOURNAMENT_POINTS } from '../src/services/tournament-scoring.constants.js'
import type { AllGroupsStandingAnswer } from '../src/types/index.js'

const teamId = (g: string, n: number): string =>
  `${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}${g.toLowerCase()}-0000-0000-0000-00000000000${n}`

const CORRECT: AllGroupsStandingAnswer = {
  groups: {
    A: [teamId('A', 1), teamId('A', 2), teamId('A', 3), teamId('A', 4)],
    B: [teamId('B', 1), teamId('B', 2), teamId('B', 3), teamId('B', 4)],
    C: [teamId('C', 1), teamId('C', 2), teamId('C', 3), teamId('C', 4)],
  },
  best3rds: [],
}

describe('scoreGroup', () => {
  it('awards perGroup points for an exact 4-team match', () => {
    expect(scoreGroup(CORRECT, CORRECT, 'A')).toBe(TOURNAMENT_POINTS.perGroup)
  })

  it('returns 0 when one position is wrong', () => {
    const wrong: AllGroupsStandingAnswer = {
      ...CORRECT,
      groups: {
        ...CORRECT.groups,
        A: [teamId('A', 2), teamId('A', 1), teamId('A', 3), teamId('A', 4)],
      },
    }
    expect(scoreGroup(wrong, CORRECT, 'A')).toBe(0)
  })

  it('returns 0 when the user has fewer teams', () => {
    const incomplete: AllGroupsStandingAnswer = {
      ...CORRECT,
      groups: {
        ...CORRECT.groups,
        A: [teamId('A', 1), teamId('A', 2), teamId('A', 3)],
      },
    }
    expect(scoreGroup(incomplete, CORRECT, 'A')).toBe(0)
  })

  it('returns 0 when a position is null', () => {
    const partial: AllGroupsStandingAnswer = {
      ...CORRECT,
      groups: {
        ...CORRECT.groups,
        A: [teamId('A', 1), teamId('A', 2), teamId('A', 3), null] as unknown as string[],
      },
    }
    expect(scoreGroup(partial, CORRECT, 'A')).toBe(0)
  })

  it('returns 0 when the group code does not exist on either side', () => {
    expect(scoreGroup(CORRECT, CORRECT, 'Z')).toBe(0)
  })

  it('returns 0 when correct or predicted is null', () => {
    expect(scoreGroup(null, CORRECT, 'A')).toBe(0)
    expect(scoreGroup(CORRECT, null, 'A')).toBe(0)
  })
})

describe('scoreAllGroupsStanding', () => {
  it('sums all perfectly-matching groups', () => {
    expect(scoreAllGroupsStanding(CORRECT, CORRECT, ['A', 'B', 'C'])).toBe(3 * TOURNAMENT_POINTS.perGroup)
  })

  it('counts only the groups that are 100% correct', () => {
    const partial: AllGroupsStandingAnswer = {
      ...CORRECT,
      groups: {
        ...CORRECT.groups,
        // B has one swap → 0p for B; A and C still perfect.
        B: [teamId('B', 2), teamId('B', 1), teamId('B', 3), teamId('B', 4)],
      },
    }
    expect(scoreAllGroupsStanding(partial, CORRECT, ['A', 'B', 'C'])).toBe(2 * TOURNAMENT_POINTS.perGroup)
  })

  it('returns 0 when nothing matches', () => {
    const allWrong: AllGroupsStandingAnswer = {
      groups: {
        A: [teamId('Z', 1), teamId('Z', 2), teamId('Z', 3), teamId('Z', 4)],
        B: [teamId('Y', 1), teamId('Y', 2), teamId('Y', 3), teamId('Y', 4)],
        C: [teamId('X', 1), teamId('X', 2), teamId('X', 3), teamId('X', 4)],
      },
      best3rds: [],
    }
    expect(scoreAllGroupsStanding(allWrong, CORRECT, ['A', 'B', 'C'])).toBe(0)
  })
})

describe('isValidGroupSlice', () => {
  it('accepts a valid slice present in availableGroups', () => {
    expect(isValidGroupSlice('group_A', ['A', 'B', 'C'])).toBe(true)
  })

  it('rejects when slice format is wrong', () => {
    expect(isValidGroupSlice('groupA', ['A', 'B', 'C'])).toBe(false)
    expect(isValidGroupSlice('group_', ['A', 'B', 'C'])).toBe(false)
  })

  it('rejects when group is not in availableGroups', () => {
    expect(isValidGroupSlice('group_Z', ['A', 'B', 'C'])).toBe(false)
  })
})
