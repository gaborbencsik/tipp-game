import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TeamSelectDropdown from './TeamSelectDropdown.vue'
import { buildTestI18n } from '@/test-utils/i18n'

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
    global: { plugins: [buildTestI18n()] },
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

    const options = wrapper.findAll('option')
    const fallback = options.find(o => (o.element as HTMLOptionElement).value === TEAM_UUID)
    expect(fallback).toBeDefined()
    expect(fallback!.text()).toBe('Brazília')
  })

  it('does not render fallback option when modelValue exists in teamsList', async () => {
    leagueTeamsMock.mockResolvedValue([{ id: TEAM_UUID, name: 'Brazília' }])
    const wrapper = mountDropdown({ modelValue: TEAM_UUID, leagueId: 'l1', answerLabel: 'Brazília' })
    await flushPromises()

    const matching = wrapper.findAll('option').filter(o => (o.element as HTMLOptionElement).value === TEAM_UUID)
    expect(matching).toHaveLength(1)
  })

  it('does not render fallback option when answerLabel is null', async () => {
    leagueTeamsMock.mockResolvedValue([{ id: 'other', name: 'Other team' }])
    const wrapper = mountDropdown({ modelValue: TEAM_UUID, leagueId: 'l1', answerLabel: null })
    await flushPromises()

    const options = wrapper.findAll('option')
    const fallback = options.find(o => (o.element as HTMLOptionElement).value === TEAM_UUID)
    expect(fallback).toBeUndefined()
  })
})
