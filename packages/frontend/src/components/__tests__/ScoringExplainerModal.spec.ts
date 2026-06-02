import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import hu from '../../locales/hu.json'
import en from '../../locales/en.json'
import ScoringExplainerModal from '../ScoringExplainerModal.vue'
import { useScoringExplainerStore } from '../../stores/scoring-explainer.store'

const i18n = createI18n({ legacy: false, locale: 'hu', messages: { hu, en } })

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
  beforeEach(() => setActivePinia(createPinia()))

  it('1 csoport — fejléc a csoportnévvel', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [{ id: 'g1', name: 'Pulykák', config: { correctOutcomePoints: 1, exactBonusPoints: 2, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] }],
    })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Pulykák pontozása')
  })

  it('2+ csoport — torna tippek és statisztikai szekció megjelenik', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [
        { id: 'g1', name: 'Pulykák', config: { correctOutcomePoints: 1, exactBonusPoints: 2, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] },
        { id: 'g2', name: 'Office', config: { correctOutcomePoints: 2, exactBonusPoints: 1, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: false, specialTypes: [] },
      ],
    })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Eltalált világbajnok')
    expect(wrapper.text()).toContain('Torna gólkirálya')
  })

  it('match-pontozás — 3 stackelhető szabály jelenik meg', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Helyes kimenetel (1-X-2)')
    expect(wrapper.text()).toContain('Pontos eredmény bónusz')
    expect(wrapper.text()).toContain('Hosszabbítás/tizenegyes kimenetel bónusz')
  })

  it('kedvenc csapat ×2 multiplier sor mindig megjelenik a meccs-pontozásban', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData({
      groups: [{ id: 'g1', name: 'X', config: { correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1 }, configFrozenAt: null, favoriteTeamDoublePoints: true, specialTypes: [] }],
    })
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Kedvenc csapat meccse')
    expect(wrapper.text()).toContain('×2')
  })

  it('ESC bezárja a modalt', async () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    mount(ScoringExplainerModal, { global: { plugins: [i18n] }, attachTo: document.body })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await new Promise(r => setTimeout(r, 0))
    expect(store.isOpen).toBe(false)
  })

  it('isOpen=false → nem renderel semmit', () => {
    const store = useScoringExplainerStore()
    store.isOpen = false
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('mobil kártya layout — minden meccs-szabály külön kártyában megjelenik', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
    const cards = wrapper.findAll('[data-testid="match-rule-card"]')
    expect(cards).toHaveLength(4)
    expect(cards[0]!.text()).toContain('Helyes kimenetel (1-X-2)')
    expect(cards[0]!.text()).toContain('Te: 2-0')
    expect(cards[3]!.text()).toContain('Kedvenc csapat meccse')
    expect(cards[3]!.text()).toContain('×2')
  })

  it('mobil container `sm:hidden`, desktop táblázat container `hidden sm:block`', () => {
    const store = useScoringExplainerStore()
    store.isOpen = true
    store.data = makeData()
    const wrapper = mount(ScoringExplainerModal, { global: { plugins: [i18n] } })
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
