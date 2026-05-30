import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PositionTeamDropdown from './PositionTeamDropdown.vue'
import type { Team } from '@/types/index'

const A1: Team = { id: 'a1', name: 'Argentina', shortCode: 'ARG', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A2: Team = { id: 'a2', name: 'Brazília', shortCode: 'BRA', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A3: Team = { id: 'a3', name: 'Chile', shortCode: 'CHI', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }
const A4: Team = { id: 'a4', name: 'Dánia', shortCode: 'DEN', flagUrl: null, group: 'A', teamType: 'national', countryCode: null }

describe('PositionTeamDropdown', () => {
  it('renders all teams when no others assigned', async () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 1,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [null, null, null, null],
        modelValue: null,
      },
    })
    await wrapper.find('[data-testid="position-dropdown-A-1"]').trigger('click')
    const options = wrapper.findAll('[data-testid^="position-dropdown-option-A-1-"]')
    expect(options.map(o => o.attributes('data-testid'))).toEqual([
      'position-dropdown-option-A-1-a1',
      'position-dropdown-option-A-1-a2',
      'position-dropdown-option-A-1-a3',
      'position-dropdown-option-A-1-a4',
    ])
  })

  it('hides teams used in other positions of the same group', async () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 1,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [null, A2.id, A3.id, null],
        modelValue: null,
      },
    })
    await wrapper.find('[data-testid="position-dropdown-A-1"]').trigger('click')
    const ids = wrapper.findAll('[data-testid^="position-dropdown-option-A-1-"]').map(o => o.attributes('data-testid'))
    expect(ids).toContain('position-dropdown-option-A-1-a1')
    expect(ids).toContain('position-dropdown-option-A-1-a4')
    expect(ids).not.toContain('position-dropdown-option-A-1-a2')
    expect(ids).not.toContain('position-dropdown-option-A-1-a3')
  })

  it('keeps the team currently assigned to its own position visible', async () => {
    const wrapper = mount(PositionTeamDropdown, {
      props: {
        position: 2,
        groupCode: 'A',
        groupTeams: [A1, A2, A3, A4],
        currentAssignments: [A1.id, A2.id, null, null],
        modelValue: A2.id,
      },
    })
    await wrapper.find('[data-testid="position-dropdown-A-2"]').trigger('click')
    const ids = wrapper.findAll('[data-testid^="position-dropdown-option-A-2-"]').map(o => o.attributes('data-testid'))
    expect(ids).toContain('position-dropdown-option-A-2-a2')
    expect(ids).not.toContain('position-dropdown-option-A-2-a1')
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
    await wrapper.find('[data-testid="position-dropdown-A-1"]').trigger('click')
    await wrapper.find('[data-testid="position-dropdown-option-A-1-clear"]').trigger('click')
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
    await wrapper.find('[data-testid="position-dropdown-A-1"]').trigger('click')
    await wrapper.find('[data-testid="position-dropdown-option-A-1-a1"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([A1.id])
  })
})
