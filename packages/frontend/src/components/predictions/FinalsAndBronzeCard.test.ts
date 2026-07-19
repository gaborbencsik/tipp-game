import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FinalsAndBronzeCard from './FinalsAndBronzeCard.vue'
import type { Team } from '@/types/index'
import type { DerivedMatch } from '@/lib/bracketDerive'

const SPA: Team = { id: 'spa', name: 'Spanyolország', shortCode: 'SPA', flagUrl: null, group: null, teamType: 'national', countryCode: null }
const POR: Team = { id: 'por', name: 'Portugália', shortCode: 'POR', flagUrl: null, group: null, teamType: 'national', countryCode: null }

const TEAM_MAP = new Map<string, Team>([[SPA.id, SPA], [POR.id, POR]])

const FINAL_MATCH: DerivedMatch = {
  id: 'final', round: 'final', slotA: '<sf1>', slotB: '<sf2>',
  teamA: SPA.id, teamB: POR.id, winnerId: SPA.id, isLocked: false,
}

const EVALUATION = {
  final: { matched: 1, points: 12, pointsPerTeam: 6 },
  champion: { hit: true, points: 12 },
}

function mountCard(overrides: Record<string, unknown> = {}) {
  return mount(FinalsAndBronzeCard, {
    props: {
      matches: [FINAL_MATCH],
      expanded: true,
      teamMap: TEAM_MAP,
      ...overrides,
    },
  })
}

describe('FinalsAndBronzeCard – UX-047 „A te tipped" sor', () => {
  it('nem renderel tipp sort, ha nincs evaluation', () => {
    const wrapper = mountCard({ evaluation: null })
    expect(wrapper.find('[data-testid="bracket-final-user-pick"]').exists()).toBe(false)
  })

  it('függőben (⏳), ha evaluation megvan de championId null', () => {
    const wrapper = mountCard({ evaluation: EVALUATION, championId: null })
    const row = wrapper.find('[data-testid="bracket-final-user-pick"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('⏳')
    expect(row.text()).not.toContain('✓')
    expect(row.text()).not.toContain('✗')
    expect(row.html()).not.toContain('line-through')
  })

  it('talált (zöld ✓), ha championId === a user tippje', () => {
    const wrapper = mountCard({ evaluation: EVALUATION, championId: SPA.id })
    const row = wrapper.find('[data-testid="bracket-final-user-pick"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('✓')
    expect(row.classes().some(c => c.includes('emerald'))).toBe(true)
    expect(row.html()).not.toContain('line-through')
  })

  it('nem talált (piros ✗, áthúzva), ha championId !== a user tippje', () => {
    const wrapper = mountCard({ evaluation: EVALUATION, championId: POR.id })
    const row = wrapper.find('[data-testid="bracket-final-user-pick"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('✗')
    expect(row.classes().some(c => c.includes('red'))).toBe(true)
    expect(row.html()).toContain('line-through')
  })
})
