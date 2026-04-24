export interface StatPredictionTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly inputType: 'text' | 'dropdown' | 'team_select'
  readonly options: string[] | null
  readonly defaultPoints: number
}

export const STAT_PREDICTION_TEMPLATES: readonly StatPredictionTemplate[] = [
  {
    id: 'world_cup_winner',
    name: 'Világbajnok csapat',
    description: 'Melyik csapat nyeri a világbajnokságot?',
    inputType: 'team_select',
    options: null,
    defaultPoints: 10,
  },
  {
    id: 'runner_up',
    name: 'Döntős csapat (nem bajnok)',
    description: 'Melyik csapat lesz a döntő vesztese?',
    inputType: 'team_select',
    options: null,
    defaultPoints: 6,
  },
  {
    id: 'golden_boot',
    name: 'Gólkirály',
    description: 'Ki lesz a torna gólkirálya?',
    inputType: 'text',
    options: null,
    defaultPoints: 8,
  },
  {
    id: 'most_goals_match',
    name: 'Legtöbb gól egy meccsen',
    description: 'Melyik meccsen esik a legtöbb gól? (pl. "Franciaország – Brazília")',
    inputType: 'text',
    options: null,
    defaultPoints: 5,
  },
  {
    id: 'most_goals_team',
    name: 'Legtöbb gólt szerző csapat',
    description: 'Melyik csapat szerzi a legtöbb gólt a tornán?',
    inputType: 'team_select',
    options: null,
    defaultPoints: 5,
  },
  {
    id: 'most_cards_team',
    name: 'Legtöbb lapot kapott csapat',
    description: 'Melyik csapat kap a legtöbb lapot a tornán?',
    inputType: 'team_select',
    options: null,
    defaultPoints: 4,
  },
]
