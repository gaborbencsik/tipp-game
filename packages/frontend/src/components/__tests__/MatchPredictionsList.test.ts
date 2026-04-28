import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MatchPredictionsList from '../MatchPredictionsList.vue'
import type { MatchPrediction } from '../../types/index.js'

const PREDICTIONS: MatchPrediction[] = [
  { userId: 'u1', displayName: 'Alice', homeGoals: 2, awayGoals: 1, pointsGlobal: 3 },
  { userId: 'u2', displayName: 'Bob', homeGoals: 1, awayGoals: 0, pointsGlobal: 1 },
  { userId: 'u3', displayName: 'Carol', homeGoals: 0, awayGoals: 2, pointsGlobal: 0 },
]

function mountComponent(predictions: MatchPrediction[] = PREDICTIONS, currentUserId = 'u2') {
  return mount(MatchPredictionsList, {
    props: { predictions, currentUserId },
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
      { userId: 'u4', displayName: 'Dave', homeGoals: 1, awayGoals: 1, pointsGlobal: null },
    ]
    const wrapper = mountComponent(preds, 'other')
    expect(wrapper.find('[data-testid="prediction-row-u4"]').text()).toContain('– pont')
  })

  it('shows section header', () => {
    const wrapper = mountComponent()
    expect(wrapper.text()).toContain('Mások tippjei')
  })
})
