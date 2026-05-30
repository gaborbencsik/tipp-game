import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PositionTeamDropdown from './PositionTeamDropdown.vue'
import type { Team } from '@/types/index'

const A1: Team = { id: 'a1', name: 'Argentina', shortCode: 'ARG', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A2: Team = { id: 'a2', name: 'Brazília', shortCode: 'BRA', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A3: Team = { id: 'a3', name: 'Chile', shortCode: 'CHI', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A4: Team = { id: 'a4', name: 'Dánia', shortCode: 'DEN', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }

describe('PositionTeamDropdown', () => {
  it('renders all teams when no others assigned', () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 1,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [null, null, null, null],
        modelValue: null,
      },
    })
    const options = wrapper.findAll('option')
    expect(options).toHaveLength(5)
  })

  it('hides teams used in other positions of the same group', () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 1,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [null, A2.id, A3.id, null],
        modelValue: null,
      },
    })
    const optionValues = wrapper.findAll('option').map(o => o.attributes('value'))
    expect(optionValues).toContain('')
    expect(optionValues).toContain(A1.id)
    expect(optionValues).toContain(A4.id)
    expect(optionValues).not.toContain(A2.id)
    expect(optionValues).not.toContain(A3.id)
  })

  it('keeps the team currently assigned to its own position visible', () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 2,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [A1.id, A2.id, null, null],
        modelValue: A2.id,
      },
    })
    const optionValues = wrapper.findAll('option').map(o => o.attributes('value'))
    expect(optionValues).toContain(A2.id)
    expect(optionValues).not.toContain(A1.id)
  })

  it('emits null when placeholder is selected', async () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 1,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [A1.id, null, null, null],
        modelValue: A1.id,
      },
    })
    const select = wrapper.find('select')
    ;(select.element as HTMLSelectElement).value = ''
    await select.trigger('change')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([null])
  })

  it('emits the team id when a team is selected', async () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 1,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [null, null, null, null],
        modelValue: null,
      },
    })
    const select = wrapper.find('select')
    ;(select.element as HTMLSelectElement).value = A1.id
    await select.trigger('change')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([A1.id])
  })
})
