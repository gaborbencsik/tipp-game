import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OutcomeAfterDrawBadge from '../OutcomeAfterDrawBadge.vue'
import type { MatchTeam } from '@/types/index'

const HOME: MatchTeam = {
  id: 'home-1', name: 'Magyarország', shortCode: 'HUN', flagUrl: null,
  teamType: 'national', countryCode: 'hu', marketValueEur: null, transfermarktId: null,
}
const AWAY: MatchTeam = {
  id: 'away-1', name: 'Szerbia', shortCode: 'SRB', flagUrl: null,
  teamType: 'national', countryCode: 'rs', marketValueEur: null, transfermarktId: null,
}

function mountBadge(props: Partial<{
  status: 'no-tip' | 'pending' | 'inactive' | 'correct' | 'incorrect'
  predictionOutcome: 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away' | null
  homeTeam: MatchTeam
  awayTeam: MatchTeam
  bonusPoints: number | null
}> = {}) {
  return mount(OutcomeAfterDrawBadge, {
    props: {
      status: 'correct',
      predictionOutcome: 'penalties_home',
      homeTeam: HOME,
      awayTeam: AWAY,
      bonusPoints: 1,
      ...props,
    },
  })
}

describe('OutcomeAfterDrawBadge', () => {
  it('renders the advancing team name (home)', () => {
    const wrapper = mountBadge({ predictionOutcome: 'penalties_home', homeTeam: HOME, awayTeam: AWAY })
    expect(wrapper.text()).toContain('Magyarország')
  })

  it('renders the advancing team name (away)', () => {
    const wrapper = mountBadge({ predictionOutcome: 'extra_time_away', homeTeam: HOME, awayTeam: AWAY })
    expect(wrapper.text()).toContain('Szerbia')
  })

  it('shows a green "correct" style with the bonus point label', () => {
    const wrapper = mountBadge({ status: 'correct', bonusPoints: 1 })
    const badge = wrapper.find('[data-testid="outcome-after-draw-badge"]')
    expect(badge.classes().join(' ')).toMatch(/green|emerald/)
    expect(badge.attributes('data-status')).toBe('correct')
    expect(wrapper.text()).toContain('+1')
  })

  it('shows a gray "incorrect" style with strike-through team name', () => {
    const wrapper = mountBadge({ status: 'incorrect', bonusPoints: 0 })
    const badge = wrapper.find('[data-testid="outcome-after-draw-badge"]')
    expect(badge.attributes('data-status')).toBe('incorrect')
    expect(wrapper.find('[data-testid="outcome-after-draw-team"]').classes().join(' ')).toMatch(/line-through|strike/)
  })

  it('shows an inactive (not-a-draw) state', () => {
    const wrapper = mountBadge({ status: 'inactive', bonusPoints: null })
    expect(wrapper.find('[data-testid="outcome-after-draw-badge"]').attributes('data-status')).toBe('inactive')
    expect(wrapper.text()).toContain('Nem volt döntetlen')
  })

  it('shows a pending state when the result is not yet recorded', () => {
    const wrapper = mountBadge({ status: 'pending', bonusPoints: null })
    expect(wrapper.find('[data-testid="outcome-after-draw-badge"]').attributes('data-status')).toBe('pending')
    expect(wrapper.text()).toContain('Kiértékelés alatt')
  })

  it('shows a "no-tip" state when the user has no prediction', () => {
    const wrapper = mountBadge({ status: 'no-tip', predictionOutcome: null, bonusPoints: null })
    expect(wrapper.find('[data-testid="outcome-after-draw-badge"]').attributes('data-status')).toBe('no-tip')
    expect(wrapper.text()).toContain('Nincs tipp')
  })

  it('does not render anything when status is "not-applicable"', () => {
    const wrapper = mount(OutcomeAfterDrawBadge, {
      props: {
        status: 'not-applicable' as const,
        predictionOutcome: null,
        homeTeam: HOME,
        awayTeam: AWAY,
        bonusPoints: null,
      },
    })
    expect(wrapper.find('[data-testid="outcome-after-draw-badge"]').exists()).toBe(false)
  })

  it('does not show +bonus when bonusPoints is 0 (incorrect)', () => {
    const wrapper = mountBadge({ status: 'incorrect', bonusPoints: 0 })
    expect(wrapper.text()).not.toContain('+0')
  })

  it('shows "hosszabbítás" mode label for extra_time outcomes', () => {
    const wrapper = mountBadge({ status: 'correct', predictionOutcome: 'extra_time_home' })
    const mode = wrapper.find('[data-testid="outcome-after-draw-mode"]')
    expect(mode.exists()).toBe(true)
    expect(mode.text()).toContain('hosszabbítás')
  })

  it('shows "11-esek" mode label for penalties outcomes', () => {
    const wrapper = mountBadge({ status: 'incorrect', predictionOutcome: 'penalties_away', bonusPoints: 0 })
    const mode = wrapper.find('[data-testid="outcome-after-draw-mode"]')
    expect(mode.exists()).toBe(true)
    expect(mode.text()).toContain('11-esek')
  })

  it('does not show mode label when there is no prediction (no-tip)', () => {
    const wrapper = mountBadge({ status: 'no-tip', predictionOutcome: null, bonusPoints: null })
    expect(wrapper.find('[data-testid="outcome-after-draw-mode"]').exists()).toBe(false)
  })
})
