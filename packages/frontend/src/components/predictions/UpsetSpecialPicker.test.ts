import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import UpsetSpecialPicker from './UpsetSpecialPicker.vue'
import type { MultiTeamWeightedOptions } from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
    },
  },
}))

const teamsListMock = vi.fn()

vi.mock('@/api/index', () => ({
  api: {
    teams: { list: (...args: unknown[]) => teamsListMock(...args) },
  },
}))

const SPAIN = '11111111-2222-3333-4444-aaaaaaaaaaa1'
const FRANCE = '11111111-2222-3333-4444-aaaaaaaaaaa2'
const BRAZIL = '11111111-2222-3333-4444-aaaaaaaaaaa3'

const OPTIONS: MultiTeamWeightedOptions = {
  maxPicks: 2,
  minPicks: 2,
  choices: [
    { teamId: BRAZIL, points: 15 },
    { teamId: SPAIN, points: 18 },
    { teamId: FRANCE, points: 17 },
  ],
}

const i18n = createI18n({
  legacy: false,
  locale: 'hu',
  messages: {
    hu: {
      upsetSpecial: {
        instruction: 'Válassz pontosan {max}.',
        selectedCount: 'Kiválasztva: {n}/{max}',
      },
    },
  },
})

function mountPicker(props: { options: MultiTeamWeightedOptions; answer: string | null }) {
  return mount(UpsetSpecialPicker, {
    props,
    global: { plugins: [i18n] },
  })
}

describe('UpsetSpecialPicker', () => {
  beforeEach(() => {
    teamsListMock.mockReset()
    teamsListMock.mockResolvedValue([
      { id: SPAIN, name: 'Spanyolország', flagUrl: null },
      { id: FRANCE, name: 'Franciaország', flagUrl: null },
      { id: BRAZIL, name: 'Brazília', flagUrl: null },
    ])
  })

  it('renders choices sorted by points descending', async () => {
    const wrapper = mountPicker({ options: OPTIONS, answer: null })
    await flushPromises()

    const items = wrapper.findAll('li')
    expect(items[0].attributes('data-testid')).toBe(`upset-choice-${SPAIN}`)
    expect(items[1].attributes('data-testid')).toBe(`upset-choice-${FRANCE}`)
    expect(items[2].attributes('data-testid')).toBe(`upset-choice-${BRAZIL}`)
  })

  it('emits submit with JSON-encoded picks once max is reached', async () => {
    const wrapper = mountPicker({ options: OPTIONS, answer: null })
    await flushPromises()

    await wrapper.find(`[data-testid="upset-choice-${SPAIN}"]`).trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()

    await wrapper.find(`[data-testid="upset-choice-${FRANCE}"]`).trigger('click')
    const events = wrapper.emitted('submit')!
    expect(events).toHaveLength(1)
    expect(JSON.parse(events[0][0] as string)).toEqual([SPAIN, FRANCE])
  })

  it('toggles a pick off when clicked again', async () => {
    const wrapper = mountPicker({ options: OPTIONS, answer: JSON.stringify([SPAIN, FRANCE]) })
    await flushPromises()

    await wrapper.find(`[data-testid="upset-choice-${SPAIN}"]`).trigger('click')
    const events = wrapper.emitted('submit')
    expect(events).toBeUndefined()

    const spainItem = wrapper.find(`[data-testid="upset-choice-${SPAIN}"]`)
    expect(spainItem.classes().some(c => c.includes('bg-blue'))).toBe(false)
  })

  it('preselects from existing answer JSON', async () => {
    const wrapper = mountPicker({ options: OPTIONS, answer: JSON.stringify([SPAIN, BRAZIL]) })
    await flushPromises()

    const spainItem = wrapper.find(`[data-testid="upset-choice-${SPAIN}"]`)
    const brazilItem = wrapper.find(`[data-testid="upset-choice-${BRAZIL}"]`)
    const franceItem = wrapper.find(`[data-testid="upset-choice-${FRANCE}"]`)
    expect(spainItem.classes().some(c => c.includes('bg-blue'))).toBe(true)
    expect(brazilItem.classes().some(c => c.includes('bg-blue'))).toBe(true)
    expect(franceItem.classes().some(c => c.includes('bg-blue'))).toBe(false)
  })

  it('does not allow selecting beyond maxPicks', async () => {
    const wrapper = mountPicker({ options: OPTIONS, answer: JSON.stringify([SPAIN, FRANCE]) })
    await flushPromises()

    await wrapper.find(`[data-testid="upset-choice-${BRAZIL}"]`).trigger('click')
    const brazilItem = wrapper.find(`[data-testid="upset-choice-${BRAZIL}"]`)
    expect(brazilItem.classes().some(c => c.includes('bg-blue'))).toBe(false)
  })
})
