import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Best3rdPicker from './Best3rdPicker.vue'
import type { Team } from '@/types/index'

const A3: Team = { id: 'a3', name: 'Chile', shortCode: 'CHI', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const B3: Team = { id: 'b3', name: 'Eire', shortCode: 'IRL', flagUrl: null, group: 'B', teamType: 'national', countryCode: null }
const C3: Team = { id: 'c3', name: 'Ghána', shortCode: 'GHA', flagUrl: null, group: 'C', teamType: 'national', countryCode: null }

const teamMap = new Map<string, Team>([[A3.id, A3], [B3.id, B3], [C3.id, C3]])

describe('Best3rdPicker', () => {
  it('shows the locked placeholder when not unlocked', () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: false, availableTeams: [], selected: [], maxPicks: 4, teamMap },
    })
    expect(wrapper.find('[data-testid="best-3rd-locked"]').exists()).toBe(true)
  })

  it('renders chips for available teams when unlocked', () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: true, availableTeams: [A3.id, B3.id, C3.id], selected: [], maxPicks: 4, teamMap },
    })
    expect(wrapper.find(`[data-testid="best-3rd-chip-${A3.id}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="best-3rd-chip-${B3.id}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="best-3rd-chip-${C3.id}"]`).exists()).toBe(true)
  })

  it('emits toggle when an unselected chip is clicked', async () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: true, availableTeams: [A3.id, B3.id], selected: [], maxPicks: 2, teamMap },
    })
    await wrapper.find(`[data-testid="best-3rd-chip-${A3.id}"]`).trigger('click')
    expect(wrapper.emitted('toggle')![0]).toEqual([A3.id])
  })

  it('emits toggle to deselect when a selected chip is clicked', async () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: true, availableTeams: [A3.id, B3.id], selected: [A3.id], maxPicks: 2, teamMap },
    })
    await wrapper.find(`[data-testid="best-3rd-chip-${A3.id}"]`).trigger('click')
    expect(wrapper.emitted('toggle')![0]).toEqual([A3.id])
  })

  it('emits overflow instead of toggle when at maxPicks and selecting a new team', async () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: true, availableTeams: [A3.id, B3.id, C3.id], selected: [A3.id, B3.id], maxPicks: 2, teamMap },
    })
    await wrapper.find(`[data-testid="best-3rd-chip-${C3.id}"]`).trigger('click')
    expect(wrapper.emitted('toggle')).toBeUndefined()
    expect(wrapper.emitted('overflow')).toHaveLength(1)
  })

  it('still allows deselecting an already-selected chip when at maxPicks', async () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: true, availableTeams: [A3.id, B3.id], selected: [A3.id, B3.id], maxPicks: 2, teamMap },
    })
    await wrapper.find(`[data-testid="best-3rd-chip-${A3.id}"]`).trigger('click')
    expect(wrapper.emitted('toggle')![0]).toEqual([A3.id])
  })

  it('shows the counter as selected/maxPicks', () => {
    const wrapper = mount(Best3rdPicker, {
      props: { unlocked: true, availableTeams: [A3.id], selected: [A3.id], maxPicks: 4, teamMap },
    })
    expect(wrapper.find('[data-testid="best-3rd-counter"]').text()).toContain('1 / 4')
  })
})
