import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MatchPredictionsList from '../MatchPredictionsList.vue'
import type { MatchPrediction, MatchResult, MatchStage, MatchTeam } from '../../types/index.js'

const SCORER_DEFAULTS = {
  scorerPickPlayerId: null,
  scorerPlayerNameSnapshot: null,
  scorerBonusPoints: null,
} as const

const PREDICTION_DEFAULTS = {
  outcomeAfterDraw: null,
} as const

const PREDICTIONS: MatchPrediction[] = [
  { userId: 'u1', displayName: 'Alice', homeGoals: 2, awayGoals: 1, pointsGlobal: 3, pointsResult: 3, isSupporter: false, ...PREDICTION_DEFAULTS, ...SCORER_DEFAULTS },
  { userId: 'u2', displayName: 'Bob', homeGoals: 1, awayGoals: 0, pointsGlobal: 1, pointsResult: 1, isSupporter: false, ...PREDICTION_DEFAULTS, ...SCORER_DEFAULTS },
  { userId: 'u3', displayName: 'Carol', homeGoals: 0, awayGoals: 2, pointsGlobal: 0, pointsResult: 0, isSupporter: false, ...PREDICTION_DEFAULTS, ...SCORER_DEFAULTS },
]

function mountComponent(
  predictions: MatchPrediction[] = PREDICTIONS,
  currentUserId = 'u2',
  extra: Partial<{ stage: MatchStage; result: MatchResult | null; homeTeam: MatchTeam; awayTeam: MatchTeam; extraTimeBonusPoints: number }> = {},
) {
  return mount(MatchPredictionsList, {
    props: { predictions, currentUserId, ...extra },
  })
}

describe('MatchPredictionsList', () => {
  it('renders all prediction rows', () => {
    const wrapper = mountComponent()
    expect(wrapper.findAll('[data-testid^="prediction-row-"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).toContain('Carol')
  })

  it('displays prediction scores in correct format', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('2 – 1')
    expect(wrapper.text()).toContain('1 – 0')
    expect(wrapper.text()).toContain('0 – 2')
  })

  it('displays points for each row', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="prediction-row-u1"]').text()).toContain('3 pont')
    expect(wrapper.find('[data-testid="prediction-row-u2"]').text()).toContain('1 pont')
    expect(wrapper.find('[data-testid="prediction-row-u3"]').text()).toContain('0 pont')
  })

  it('highlights exact match (3 pts) with green classes', () => {
    const wrapper = mountComponent()
    const row = wrapper.find('[data-testid="prediction-row-u1"]')
    expect(row.classes()).toContain('bg-green-50')
    expect(row.classes()).toContain('border-green-500')
  })

  it('does not apply green highlight to non-exact rows', () => {
    const wrapper = mountComponent()
    const row = wrapper.find('[data-testid="prediction-row-u2"]')
    expect(row.classes()).not.toContain('bg-green-50')
    expect(row.classes()).toContain('border-transparent')
  })

  it('highlights current user row with blue classes', () => {
    const wrapper = mountComponent(PREDICTIONS, 'u2')
    const row = wrapper.find('[data-testid="prediction-row-u2"]')
    expect(row.classes()).toContain('ring-2')
    expect(row.classes()).toContain('ring-blue-300')
    expect(row.classes()).toContain('bg-blue-50')
  })

  it('does not apply blue highlight to other users', () => {
    const wrapper = mountComponent(PREDICTIONS, 'u2')
    const row = wrapper.find('[data-testid="prediction-row-u1"]')
    expect(row.classes()).not.toContain('ring-2')
  })

  it('displays dash for null pointsGlobal', () => {
    const preds: MatchPrediction[] = [
      { userId: 'u4', displayName: 'Dave', homeGoals: 1, awayGoals: 1, pointsGlobal: null, pointsResult: null, isSupporter: false, ...PREDICTION_DEFAULTS, ...SCORER_DEFAULTS },
    ]
    const wrapper = mountComponent(preds, 'other')
    expect(wrapper.find('[data-testid="prediction-row-u4"]').text()).toContain('– pont')
  })

  it('shows section header', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Mások tippjei')
  })

  it('renders scorer chip when scorerPlayerNameSnapshot is set', () => {
    const preds: MatchPrediction[] = [
      {
        userId: 'u5', displayName: 'Eve', homeGoals: 1, awayGoals: 1, pointsGlobal: null, pointsResult: null, isSupporter: false, ...PREDICTION_DEFAULTS,
        scorerPickPlayerId: 'p-1', scorerPlayerNameSnapshot: 'Mbappé', scorerBonusPoints: null,
      },
    ]
    const wrapper = mountComponent(preds, 'other')
    const chip = wrapper.find('[data-testid="prediction-row-scorer-u5"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('Mbappé')
  })

  it('does not render scorer chip when scorerPlayerNameSnapshot is null', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="prediction-row-scorer-u1"]').exists()).toBe(false)
  })

  it('applies green class when scorerBonusPoints > 0 (hit)', () => {
    const preds: MatchPrediction[] = [
      {
        userId: 'u6', displayName: 'Frank', homeGoals: 2, awayGoals: 0, pointsGlobal: 3, pointsResult: 1, isSupporter: false, ...PREDICTION_DEFAULTS,
        scorerPickPlayerId: 'p-1', scorerPlayerNameSnapshot: 'Haaland', scorerBonusPoints: 2,
      },
    ]
    const wrapper = mountComponent(preds, 'other')
    const chip = wrapper.find('[data-testid="prediction-row-scorer-u6"]')
    expect(chip.classes()).toContain('text-green-700')
    expect(chip.classes()).toContain('bg-green-50')
  })

  it('applies neutral gray class when scorerBonusPoints is 0 (miss)', () => {
    const preds: MatchPrediction[] = [
      {
        userId: 'u7', displayName: 'Grace', homeGoals: 1, awayGoals: 0, pointsGlobal: 1, pointsResult: 1, isSupporter: false, ...PREDICTION_DEFAULTS,
        scorerPickPlayerId: 'p-1', scorerPlayerNameSnapshot: 'Vinicius', scorerBonusPoints: 0,
      },
    ]
    const wrapper = mountComponent(preds, 'other')
    const chip = wrapper.find('[data-testid="prediction-row-scorer-u7"]')
    expect(chip.classes()).toContain('text-gray-600')
    expect(chip.classes()).not.toContain('text-green-700')
  })

  it('applies neutral gray class when scorerBonusPoints is null (pending)', () => {
    const preds: MatchPrediction[] = [
      {
        userId: 'u8', displayName: 'Henry', homeGoals: 1, awayGoals: 1, pointsGlobal: null, pointsResult: null, isSupporter: false, ...PREDICTION_DEFAULTS,
        scorerPickPlayerId: 'p-1', scorerPlayerNameSnapshot: 'Salah', scorerBonusPoints: null,
      },
    ]
    const wrapper = mountComponent(preds, 'other')
    const chip = wrapper.find('[data-testid="prediction-row-scorer-u8"]')
    expect(chip.classes()).toContain('text-gray-600')
    expect(chip.classes()).not.toContain('text-green-700')
  })
})

// UX-043: knockout meccsek esetén a "döntetlen esetén továbbjutó" tipp megjelenítése
describe('MatchPredictionsList — outcomeAfterDraw (UX-043)', () => {
  const HOME: MatchTeam = {
    id: 'home', name: 'Magyarország', shortCode: 'HUN', flagUrl: null,
    teamType: 'national', countryCode: 'hu', marketValueEur: null, transfermarktId: null,
  }
  const AWAY: MatchTeam = {
    id: 'away', name: 'Szerbia', shortCode: 'SRB', flagUrl: null,
    teamType: 'national', countryCode: 'rs', marketValueEur: null, transfermarktId: null,
  }
  const KNOCKOUT_PREDICTIONS: MatchPrediction[] = [
    // u1: tipp = penalties_home, eredmény = penalties_home → correct, +1
    { userId: 'u1', displayName: 'Alice', homeGoals: 0, awayGoals: 0, outcomeAfterDraw: 'penalties_home', pointsGlobal: 2, pointsResult: 2, isSupporter: false, ...SCORER_DEFAULTS },
    // u2: tipp = penalties_away, eredmény = penalties_home → incorrect
    { userId: 'u2', displayName: 'Bob', homeGoals: 0, awayGoals: 0, outcomeAfterDraw: 'penalties_away', pointsGlobal: 1, pointsResult: 1, isSupporter: false, ...SCORER_DEFAULTS },
    // u3: nincs outcomeAfterDraw tipp
    { userId: 'u3', displayName: 'Carol', homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null, pointsGlobal: 1, pointsResult: 1, isSupporter: false, ...SCORER_DEFAULTS },
  ]

  it('shows outcome badges on every row when stage is knockout and the match is a draw', () => {
    const result: MatchResult = { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: 'penalties_home' }
    const wrapper = mountComponent(KNOCKOUT_PREDICTIONS, 'u1', {
      stage: 'round_of_16', result, homeTeam: HOME, awayTeam: AWAY, extraTimeBonusPoints: 1,
    })
    const u1Badge = wrapper.find('[data-testid="prediction-row-u1"] [data-testid="outcome-after-draw-badge"]')
    expect(u1Badge.exists()).toBe(true)
    expect(u1Badge.attributes('data-status')).toBe('correct')
    expect(u1Badge.text()).toContain('Magyarország')
    expect(u1Badge.text()).toContain('+1')

    const u2Badge = wrapper.find('[data-testid="prediction-row-u2"] [data-testid="outcome-after-draw-badge"]')
    expect(u2Badge.attributes('data-status')).toBe('incorrect')
    expect(u2Badge.text()).toContain('Szerbia')

    const u3Badge = wrapper.find('[data-testid="prediction-row-u3"] [data-testid="outcome-after-draw-badge"]')
    expect(u3Badge.attributes('data-status')).toBe('no-tip')
  })

  it('marks all predictions as "inactive" when the match was not a draw', () => {
    const result: MatchResult = { homeGoals: 1, awayGoals: 0, outcomeAfterDraw: null }
    const wrapper = mountComponent(KNOCKOUT_PREDICTIONS, 'u1', {
      stage: 'final', result, homeTeam: HOME, awayTeam: AWAY, extraTimeBonusPoints: 1,
    })
    const u1Badge = wrapper.find('[data-testid="prediction-row-u1"] [data-testid="outcome-after-draw-badge"]')
    expect(u1Badge.attributes('data-status')).toBe('inactive')
    // The team the user picked is still shown (so they remember what they tipped).
    expect(u1Badge.text()).toContain('Magyarország')
  })

  it('shows "pending" while the match has no recorded result yet', () => {
    const wrapper = mountComponent(KNOCKOUT_PREDICTIONS, 'u1', {
      stage: 'semi_final', result: null, homeTeam: HOME, awayTeam: AWAY, extraTimeBonusPoints: 1,
    })
    const u1Badge = wrapper.find('[data-testid="prediction-row-u1"] [data-testid="outcome-after-draw-badge"]')
    expect(u1Badge.attributes('data-status')).toBe('pending')
  })

  it('does not show any outcome badge for group-stage matches', () => {
    const result: MatchResult = { homeGoals: 1, awayGoals: 1 }
    const wrapper = mountComponent(KNOCKOUT_PREDICTIONS, 'u1', {
      stage: 'group', result, homeTeam: HOME, awayTeam: AWAY,
    })
    expect(wrapper.find('[data-testid="outcome-after-draw-badge"]').exists()).toBe(false)
  })

  it('does not show outcome badges when stage/match-context props are omitted (backwards compatibility)', () => {
    const wrapper = mountComponent(KNOCKOUT_PREDICTIONS, 'u1')
    expect(wrapper.find('[data-testid="outcome-after-draw-badge"]').exists()).toBe(false)
  })
})
