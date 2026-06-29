import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import GroupStandingCard from './GroupStandingCard.vue'
import type { Team } from '@/types/index'

const i18n = createI18n({
  legacy: false,
  locale: 'hu',
  messages: {
    hu: {
      groupStandings: {
        groupTitle: '{code} csoport',
        done: '✓ Kész',
        clearGroup: 'Csoport ürítése',
        actualAnswer: 'Tényleges',
        pointsPill: '+{n} pont',
        pointsZero: '0 pont',
        scoreFooter: '{hits}/4 helyes pozíció → {points} pont',
      },
    },
  },
})

const A1: Team = { id: 'a1', name: 'Argentína', shortCode: 'ARG', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A2: Team = { id: 'a2', name: 'Brazília', shortCode: 'BRA', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A3: Team = { id: 'a3', name: 'Chile', shortCode: 'CHI', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A4: Team = { id: 'a4', name: 'Dánia', shortCode: 'DEN', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }

const GROUP_TEAMS = [A1, A2, A3, A4]

describe('GroupStandingCard – UX-039 scored mode (correctPositions)', () => {
  it('marks correct collapsed summary chips with emerald and incorrect with rose', () => {
    const wrapper = mount(GroupStandingCard, {
      props: {
        groupCode: 'A',
        groupTeams: GROUP_TEAMS,
        assignments: ['a1', 'a2', 'a3', 'a4'],
        correctPositions: ['a1', 'a3', 'a2', 'a4'],
        teamsPerGroup: 4,
        expanded: false,
        readOnlyScored: true,
      },
      global: { plugins: [i18n] },
    })
    const chips = wrapper.findAll('[data-testid^="group-standing-summary-chip-A-"]')
    expect(chips).toHaveLength(4)
    // pos 0 a1==a1 → green
    expect(chips[0]!.classes().some(c => c.includes('emerald'))).toBe(true)
    // pos 1 a2 vs a3 → red
    expect(chips[1]!.classes().some(c => c.includes('rose') || c.includes('red'))).toBe(true)
    // pos 2 a3 vs a2 → red
    expect(chips[2]!.classes().some(c => c.includes('rose') || c.includes('red'))).toBe(true)
    // pos 3 a4==a4 → green
    expect(chips[3]!.classes().some(c => c.includes('emerald'))).toBe(true)
  })

  it('renders the actual team second line for an incorrect expanded row', () => {
    const wrapper = mount(GroupStandingCard, {
      props: {
        groupCode: 'A',
        groupTeams: GROUP_TEAMS,
        assignments: ['a1', 'a2', 'a3', 'a4'],
        correctPositions: ['a1', 'a3', 'a2', 'a4'],
        teamsPerGroup: 4,
        expanded: true,
        readOnlyScored: true,
      },
      global: { plugins: [i18n] },
    })
    const row2 = wrapper.find('[data-testid="group-standing-row-A-2"]')
    expect(row2.exists()).toBe(true)
    const actualLine = wrapper.find('[data-testid="group-standing-actual-A-2"]')
    expect(actualLine.exists()).toBe(true)
    expect(actualLine.text()).toContain('Chile')
  })

  it('does not render the actual team line for a correct expanded row', () => {
    const wrapper = mount(GroupStandingCard, {
      props: {
        groupCode: 'A',
        groupTeams: GROUP_TEAMS,
        assignments: ['a1', 'a2', 'a3', 'a4'],
        correctPositions: ['a1', 'a2', 'a3', 'a4'],
        teamsPerGroup: 4,
        expanded: true,
        readOnlyScored: true,
      },
      global: { plugins: [i18n] },
    })
    expect(wrapper.find('[data-testid="group-standing-actual-A-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-standing-actual-A-2"]').exists()).toBe(false)
  })

  it('falls back to the actual team when the user did not pick a position', () => {
    const wrapper = mount(GroupStandingCard, {
      props: {
        groupCode: 'A',
        groupTeams: GROUP_TEAMS,
        assignments: ['a1', null, 'a3', 'a4'],
        correctPositions: ['a1', 'a2', 'a3', 'a4'],
        teamsPerGroup: 4,
        expanded: true,
        readOnlyScored: true,
      },
      global: { plugins: [i18n] },
    })
    const actualLine = wrapper.find('[data-testid="group-standing-actual-A-2"]')
    expect(actualLine.exists()).toBe(true)
    expect(actualLine.text()).toContain('Brazília')
  })

  // UX-040: per-card points breakdown
  describe('UX-040 points breakdown', () => {
    it('renders the green points pill when pointsAwarded > 0', () => {
      const wrapper = mount(GroupStandingCard, {
        props: {
          groupCode: 'A',
          groupTeams: GROUP_TEAMS,
          assignments: ['a1', 'a2', 'a3', 'a4'],
          correctPositions: ['a1', 'a2', 'a3', 'a4'],
          teamsPerGroup: 4,
          expanded: false,
          readOnlyScored: true,
          pointsAwarded: 3,
        },
        global: { plugins: [i18n] },
      })
      const pill = wrapper.find('[data-testid="group-standing-points-A"]')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toContain('3')
      expect(pill.classes().some(c => c.includes('emerald'))).toBe(true)
    })

    it('renders the zero pill when pointsAwarded === 0', () => {
      const wrapper = mount(GroupStandingCard, {
        props: {
          groupCode: 'A',
          groupTeams: GROUP_TEAMS,
          assignments: ['a1', 'a2', 'a3', 'a4'],
          correctPositions: ['a1', 'a3', 'a2', 'a4'],
          teamsPerGroup: 4,
          expanded: false,
          readOnlyScored: true,
          pointsAwarded: 0,
        },
        global: { plugins: [i18n] },
      })
      const pill = wrapper.find('[data-testid="group-standing-points-A"]')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toContain('0')
      // Zero is not a green badge.
      expect(pill.classes().some(c => c.includes('emerald'))).toBe(false)
    })

    it('does not render the pill when pointsAwarded is undefined', () => {
      const wrapper = mount(GroupStandingCard, {
        props: {
          groupCode: 'A',
          groupTeams: GROUP_TEAMS,
          assignments: ['a1', 'a2', 'a3', 'a4'],
          correctPositions: ['a1', 'a2', 'a3', 'a4'],
          teamsPerGroup: 4,
          expanded: false,
          readOnlyScored: true,
        },
        global: { plugins: [i18n] },
      })
      expect(wrapper.find('[data-testid="group-standing-points-A"]').exists()).toBe(false)
    })

    it('renders the expanded footer with the breakdown when expanded + scored', () => {
      const wrapper = mount(GroupStandingCard, {
        props: {
          groupCode: 'A',
          groupTeams: GROUP_TEAMS,
          assignments: ['a1', 'a2', 'a3', 'a4'],
          correctPositions: ['a1', 'a3', 'a2', 'a4'],
          teamsPerGroup: 4,
          expanded: true,
          readOnlyScored: true,
          pointsAwarded: 0,
        },
        global: { plugins: [i18n] },
      })
      const footer = wrapper.find('[data-testid="group-standing-footer-A"]')
      expect(footer.exists()).toBe(true)
      expect(footer.text()).toContain('2/4')
      expect(footer.text()).toContain('0')
    })
  })
})
