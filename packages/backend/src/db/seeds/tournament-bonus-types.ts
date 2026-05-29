import type { InferInsertModel } from 'drizzle-orm'
import type { specialPredictionTypes } from '../schema/index.js'

type SpecialPredictionTypeInsert = InferInsertModel<typeof specialPredictionTypes>

export const TOURNAMENT_FIRST_KICKOFF_AT = new Date('2026-06-11T02:00:00.000Z')

export const TOURNAMENT_BONUS_TYPE_IDS = {
  groupStageMostGoalsScored:    '11111111-1111-1111-1111-000000000001',
  groupStageFewestGoalsScored:  '11111111-1111-1111-1111-000000000002',
  groupStageMostGoalsConceded:  '11111111-1111-1111-1111-000000000003',
  groupStageFewestGoalsConceded:'11111111-1111-1111-1111-000000000004',
} as const

export const TOURNAMENT_BONUS_TYPE_SEEDS: readonly SpecialPredictionTypeInsert[] = [
  {
    id: TOURNAMENT_BONUS_TYPE_IDS.groupStageMostGoalsScored,
    groupId: null,
    name: 'Csoportkör – legtöbb gólt szerző csapat',
    description: 'Melyik csapat szerzett a legtöbb gólt a csoportkörben?',
    inputType: 'team_select',
    deadline: TOURNAMENT_FIRST_KICKOFF_AT,
    points: 3,
    isGlobal: true,
    isActive: true,
  },
  {
    id: TOURNAMENT_BONUS_TYPE_IDS.groupStageFewestGoalsScored,
    groupId: null,
    name: 'Csoportkör – legkevesebb gólt szerző csapat',
    description: 'Melyik csapat szerzett a legkevesebb gólt a csoportkörben?',
    inputType: 'team_select',
    deadline: TOURNAMENT_FIRST_KICKOFF_AT,
    points: 3,
    isGlobal: true,
    isActive: true,
  },
  {
    id: TOURNAMENT_BONUS_TYPE_IDS.groupStageMostGoalsConceded,
    groupId: null,
    name: 'Csoportkör – legtöbb gólt kapó csapat',
    description: 'Melyik csapat kapott a legtöbb gólt a csoportkörben?',
    inputType: 'team_select',
    deadline: TOURNAMENT_FIRST_KICKOFF_AT,
    points: 3,
    isGlobal: true,
    isActive: true,
  },
  {
    id: TOURNAMENT_BONUS_TYPE_IDS.groupStageFewestGoalsConceded,
    groupId: null,
    name: 'Csoportkör – legkevesebb gólt kapó csapat',
    description: 'Melyik csapat kapott a legkevesebb gólt a csoportkörben?',
    inputType: 'team_select',
    deadline: TOURNAMENT_FIRST_KICKOFF_AT,
    points: 3,
    isGlobal: true,
    isActive: true,
  },
]
