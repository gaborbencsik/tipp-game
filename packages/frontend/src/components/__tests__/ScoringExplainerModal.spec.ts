import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ScoringExplainerModal from '../ScoringExplainerModal.vue'
import { useScoringExplainerStore } from '../../stores/scoring-explainer.store'

function makeData(overrides: any = {}) {
  const baseConfig = {
    id: 'cfg', name: 'Default',
    correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
    frozenAt: null,
  }
  return {
    default: baseConfig,
    defaultFrozenAt: null,
    groups: [],
    ...overrides,
  }
}

describe('ScoringExplainerModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('1 group — header with group name', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [{ id: 'g1', name: 'Pulykák', config: { correctOutcomePoints: 1, exactBonusPoints: 2, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] }],
    })
    const wrapper = mount(ScoringExplainerModal)
    expect(wrapper.text()).toContain('Pulykák pontozása')
  })

  it('2+ groups — tournament predictions and statistics section appear', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [
        { id: 'g1', name: 'Pulykák', config: { correctOutcomePoints: 1, exactBonusPoints: 2, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] },
        { id: 'g2', name: 'Office', config: { correctOutcomePoints: 2, exactBonusPoints: 1, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] },
      ],
    })
    const wrapper = mount(ScoringExplainerModal)
    expect(wrapper.text()).toContain('Eltalált világbajnok')
    expect(wrapper.text()).toContain('Torna gólkirálya')
  })

  it('match scoring — 4 stackable rules appear', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal)
    expect(wrapper.text()).toContain('Helyes kimenetel (1-X-2)')
    expect(wrapper.text()).toContain('Pontos eredmény bónusz')
    expect(wrapper.text()).toContain('Hosszabbítás/tizenegyes kimenetel bónusz')
    expect(wrapper.text()).toContain('Góllövő tipp talált')
  })

  it('favorite team ×2 multiplier row always appears in match scoring', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [{ id: 'g1', name: 'X', config: { correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: true, specialTypes: [] }],
    })
    const wrapper = mount(ScoringExplainerModal)
    expect(wrapper.text()).toContain('Kedvenc csapat meccse')
    expect(wrapper.text()).toContain('×2')
  })

  it('ESC closes the modal', async () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    mount(ScoringExplainerModal, { attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await new Promise(r => setTimeout(r, 0))
    expect(store.isOpen).toBe(false)
  })

  it('isOpen=false → renders nothing', () => {
    const store = useScoringExplainerStore()
    store.isOpen = false
    const wrapper = mount(ScoringExplainerModal)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('mobile card layout — every match rule appears in its own card', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal)
    const cards = wrapper.findAll('[data-testid="match-rule-card"]')
    expect(cards).toHaveLength(5)
    expect(cards[0]!.text()).toContain('Helyes kimenetel (1-X-2)')
    expect(cards[0]!.text()).toContain('Te: 2-0')
    expect(cards[3]!.text()).toContain('Góllövő tipp talált')
    expect(cards[4]!.text()).toContain('Kedvenc csapat meccse')
    expect(cards[4]!.text()).toContain('×2')
  })

  it('mobile container `sm:hidden`, desktop table container `hidden sm:block`', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal)
    const mobile = wrapper.find('[data-testid="match-rules-mobile"]')
    expect(mobile.exists()).toBe(true)
    expect(mobile.classes()).toContain('sm:hidden')
    const desktopTable = wrapper.find('table')
    expect(desktopTable.exists()).toBe(true)
    const desktopWrapper = desktopTable.element.parentElement!
    expect(desktopWrapper.className).toContain('hidden')
    expect(desktopWrapper.className).toContain('sm:block')
  })
})
