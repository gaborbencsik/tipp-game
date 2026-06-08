import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlayerMultiSelectCombobox from './PlayerMultiSelectCombobox.vue'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
  },
}))

const playersListMock = vi.fn()

vi.mock('@/api/index', () => ({
  api: {
    players: {
      list: (...args: unknown[]) => playersListMock(...args),
    },
  },
}))

const HOME = { id: 't-home', name: 'Magyarország', shortCode: 'HUN', flagUrl: null }
const AWAY = { id: 't-away', name: 'Argentína', shortCode: 'ARG', flagUrl: null }

const HOME_PLAYERS = [
  { id: 'p1', name: 'Szoboszlai D.', teamId: 't-home', teamName: 'Magyarország', teamShortCode: 'HUN', position: 'Midfielder', shirtNumber: 10 },
]
const AWAY_PLAYERS = [
  { id: 'p2', name: 'Messi L.', teamId: 't-away', teamName: 'Argentína', teamShortCode: 'ARG', position: 'Attacker', shirtNumber: 10 },
]

describe('PlayerMultiSelectCombobox', () => {
  beforeEach(() => {
    playersListMock.mockReset()
    playersListMock.mockImplementation(async (_t: string, _l?: string, teamId?: string) => {
      if (teamId === 't-home') return HOME_PLAYERS
      if (teamId === 't-away') return AWAY_PLAYERS
      return []
    })
  })

  it('renders chips for each modelValue id', async () => {
    const wrapper = mount(PlayerMultiSelectCombobox, {
      props: { modelValue: ['p1', 'p2'], restrictToTeams: [HOME, AWAY] },
    })
    await flushPromises()

    const chips = wrapper.findAll('[data-chip]')
    expect(chips.length).toBe(2)
    expect(chips[0]?.text()).toContain('Szoboszlai')
    expect(chips[1]?.text()).toContain('Messi')
  })

  it('clicking a player in dropdown emits update with id added', async () => {
    const wrapper = mount(PlayerMultiSelectCombobox, {
      props: { modelValue: [], restrictToTeams: [HOME, AWAY] },
    })
    await flushPromises()
    await wrapper.find('input[type="text"]').trigger('focus')
    await flushPromises()

    const items = wrapper.findAll('li[data-selected]')
    await items[0]?.trigger('mousedown')

    const events = wrapper.emitted('update:modelValue') as Array<[ReadonlyArray<string>]>
    expect(events?.[0]?.[0]).toEqual(['p1'])
  })

  it('clicking a selected player toggles it off', async () => {
    const wrapper = mount(PlayerMultiSelectCombobox, {
      props: { modelValue: ['p1'], restrictToTeams: [HOME, AWAY] },
    })
    await flushPromises()
    await wrapper.find('input[type="text"]').trigger('focus')
    await flushPromises()

    const selected = wrapper.find('li[data-selected="true"]')
    await selected.trigger('mousedown')

    const events = wrapper.emitted('update:modelValue') as Array<[ReadonlyArray<string>]>
    expect(events?.[0]?.[0]).toEqual([])
  })

  it('chip × button removes that pick', async () => {
    const wrapper = mount(PlayerMultiSelectCombobox, {
      props: { modelValue: ['p1', 'p2'], restrictToTeams: [HOME, AWAY] },
    })
    await flushPromises()

    await wrapper.find('[data-chip-remove="p1"]').trigger('click')
    const events = wrapper.emitted('update:modelValue') as Array<[ReadonlyArray<string>]>
    expect(events?.[0]?.[0]).toEqual(['p2'])
  })

  it('dropdown lists all players from both teams (no 50-cap)', async () => {
    const wrapper = mount(PlayerMultiSelectCombobox, {
      props: { modelValue: [], restrictToTeams: [HOME, AWAY] },
    })
    await flushPromises()
    await wrapper.find('input[type="text"]').trigger('focus')
    await flushPromises()

    const items = wrapper.findAll('li[data-selected]')
    expect(items.length).toBe(2)
  })
})
