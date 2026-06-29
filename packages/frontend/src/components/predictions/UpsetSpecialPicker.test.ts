import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

function mountPicker(props: { options: MultiTeamWeightedOptions; answer: string | null }) {
  return mount(UpsetSpecialPicker, { props })
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

  // UX-041: scored read-only view — green/red/dashed feedback + breakdown.
  describe('UX-041 scored mode (correctAnswer)', () => {
    it('marks tipped + eliminated chip with emerald and shows +points pill', async () => {
      const wrapper = mount(UpsetSpecialPicker, {
        props: {
          options: OPTIONS,
          answer: JSON.stringify([SPAIN, BRAZIL]),
          correctAnswer: JSON.stringify([SPAIN, FRANCE]),
          readOnly: true,
        },
      })
      await flushPromises()
      const spainItem = wrapper.find(`[data-testid="upset-choice-${SPAIN}"]`)
      expect(spainItem.classes().some(c => c.includes('emerald'))).toBe(true)
      const pill = wrapper.find(`[data-testid="upset-points-${SPAIN}"]`)
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toContain('18')
    })

    it('marks tipped + NOT eliminated chip with rose and shows zero pill', async () => {
      const wrapper = mount(UpsetSpecialPicker, {
        props: {
          options: OPTIONS,
          answer: JSON.stringify([SPAIN, BRAZIL]),
          correctAnswer: JSON.stringify([SPAIN, FRANCE]),
          readOnly: true,
        },
      })
      await flushPromises()
      const brazilItem = wrapper.find(`[data-testid="upset-choice-${BRAZIL}"]`)
      expect(brazilItem.classes().some(c => c.includes('rose') || c.includes('red'))).toBe(true)
      const pill = wrapper.find(`[data-testid="upset-points-${BRAZIL}"]`)
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toContain('0')
    })

    it('renders an "Actual" badge on an unpicked but eliminated chip', async () => {
      const wrapper = mount(UpsetSpecialPicker, {
        props: {
          options: OPTIONS,
          answer: JSON.stringify([SPAIN, BRAZIL]),
          correctAnswer: JSON.stringify([SPAIN, FRANCE]),
          readOnly: true,
        },
      })
      await flushPromises()
      const badge = wrapper.find(`[data-testid="upset-actual-${FRANCE}"]`)
      expect(badge.exists()).toBe(true)
    })

    it('renders a breakdown summary with the total weighted points', async () => {
      const wrapper = mount(UpsetSpecialPicker, {
        props: {
          options: OPTIONS,
          answer: JSON.stringify([SPAIN, BRAZIL]),
          correctAnswer: JSON.stringify([SPAIN, FRANCE]),
          readOnly: true,
        },
      })
      await flushPromises()
      const summary = wrapper.find('[data-testid="upset-score-summary"]')
      expect(summary.exists()).toBe(true)
      // 1 helyes pick (Spain, 18p), 1 helytelen (Brazil) → összesen 18 pont
      expect(summary.text()).toContain('1')
      expect(summary.text()).toContain('18')
    })

    it('does not emit submit when readOnly', async () => {
      const wrapper = mount(UpsetSpecialPicker, {
        props: {
          options: OPTIONS,
          answer: null,
          correctAnswer: JSON.stringify([SPAIN]),
          readOnly: true,
        },
      })
      await flushPromises()
      await wrapper.find(`[data-testid="upset-choice-${SPAIN}"]`).trigger('click')
      expect(wrapper.emitted('submit')).toBeUndefined()
    })
  })
})
