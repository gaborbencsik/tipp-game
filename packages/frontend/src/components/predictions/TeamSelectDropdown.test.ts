import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TeamSelectDropdown from './TeamSelectDropdown.vue'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
    },
  },
}))

const leagueTeamsMock = vi.fn()
const teamsListMock = vi.fn()

vi.mock('@/api/index', () => ({
  api: {
    leagueTeams: { forLeague: (...args: unknown[]) => leagueTeamsMock(...args) },
    teams: { list: (...args: unknown[]) => teamsListMock(...args) },
  },
}))

const TEAM_UUID = '11111111-1111-1111-1111-111111111111'

function mountDropdown(props: { modelValue: string | null; leagueId?: string | null; answerLabel?: string | null }) {
  return mount(TeamSelectDropdown, {
    props,
  })
}

describe('TeamSelectDropdown', () => {
  beforeEach(() => {
    leagueTeamsMock.mockReset()
    teamsListMock.mockReset()
  })

  it('renders a fallback option with the answerLabel when modelValue is missing from teamsList', async () => {
    leagueTeamsMock.mockResolvedValue([{ id: 'other', name: 'Other team' }])
    const wrapper = mountDropdown({ modelValue: TEAM_UUID, leagueId: 'l1', answerLabel: 'Brazília' })
    await flushPromises()

    await wrapper.find('[data-testid="team-select-dropdown"]').trigger('click')
    const fallback = wrapper.find(`[data-testid="team-select-option-${TEAM_UUID}"]`)
    expect(fallback.exists()).toBe(true)
    expect(fallback.text()).toBe('Brazília')
  })

  it('does not render fallback option when modelValue exists in teamsList', async () => {
    leagueTeamsMock.mockResolvedValue([{ id: TEAM_UUID, name: 'Brazília' }])
    const wrapper = mountDropdown({ modelValue: TEAM_UUID, leagueId: 'l1', answerLabel: 'Brazília' })
    await flushPromises()

    await wrapper.find('[data-testid="team-select-dropdown"]').trigger('click')
    const matching = wrapper.findAll(`[data-testid="team-select-option-${TEAM_UUID}"]`)
    expect(matching).toHaveLength(1)
  })

  it('does not render fallback option when answerLabel is null', async () => {
    leagueTeamsMock.mockResolvedValue([{ id: 'other', name: 'Other team' }])
    const wrapper = mountDropdown({ modelValue: TEAM_UUID, leagueId: 'l1', answerLabel: null })
    await flushPromises()

    await wrapper.find('[data-testid="team-select-dropdown"]').trigger('click')
    const fallback = wrapper.find(`[data-testid="team-select-option-${TEAM_UUID}"]`)
    expect(fallback.exists()).toBe(false)
  })

  it('renders the selected team flag in the trigger when team has flagUrl', async () => {
    leagueTeamsMock.mockResolvedValue([
      { id: TEAM_UUID, name: 'Brazília', shortCode: 'BRA', flagUrl: 'https://flags/bra.png' },
    ])
    const wrapper = mountDropdown({ modelValue: TEAM_UUID, leagueId: 'l1', answerLabel: null })
    await flushPromises()

    const trigger = wrapper.find('[data-testid="team-select-dropdown"]')
    expect(trigger.find('img').exists()).toBe(true)
    expect(trigger.find('img').attributes('src')).toBe('https://flags/bra.png')
  })

  it('emits update:modelValue when an option is clicked', async () => {
    leagueTeamsMock.mockResolvedValue([{ id: TEAM_UUID, name: 'Brazília', shortCode: 'BRA', flagUrl: null }])
    const wrapper = mountDropdown({ modelValue: null, leagueId: 'l1', answerLabel: null })
    await flushPromises()

    await wrapper.find('[data-testid="team-select-dropdown"]').trigger('click')
    await wrapper.find(`[data-testid="team-select-option-${TEAM_UUID}"]`).trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([TEAM_UUID])
  })
})
