import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlayerSelectCombobox from './PlayerSelectCombobox.vue'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
    },
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

const UUID = '09761da0-c6b6-456b-b753-cafc287240bc'

function mountCombobox(props: {
  modelValue: string | null
  leagueId?: string | null
  answerLabel?: string | null
  restrictToTeams?: Array<{ id: string; name: string; shortCode: string; flagUrl: string | null }>
  allowExplicitClear?: boolean
  showPlayerMeta?: boolean
  size?: 'compact' | 'comfortable'
}) {
  return mount(PlayerSelectCombobox, {
    props,
  })
}

describe('PlayerSelectCombobox', () => {
  beforeEach(() => {
    playersListMock.mockReset()
  })

  it('shows the answerLabel instead of UUID when player list is empty', async () => {
    playersListMock.mockResolvedValue([])
    const wrapper = mountCombobox({ modelValue: UUID, leagueId: 'l1', answerLabel: 'Mbappé' })
    await flushPromises()

    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe('Mbappé')
    expect(input.value).not.toContain(UUID)
  })

  it('does not enter freeTextMode when answerLabel is provided', async () => {
    playersListMock.mockResolvedValue([])
    const wrapper = mountCombobox({ modelValue: UUID, leagueId: 'l1', answerLabel: 'Mbappé' })
    await flushPromises()

    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('falls back to free-text mode and shows raw modelValue when answerLabel is null', async () => {
    playersListMock.mockResolvedValue([])
    const wrapper = mountCombobox({ modelValue: 'plain text', leagueId: 'l1', answerLabel: null })
    await flushPromises()

    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe('plain text')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('uses player name from playersList when player is in current league', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Vinicius Jr.', teamId: 't1', teamName: 'Brazil', teamShortCode: 'BRA' },
    ])
    const wrapper = mountCombobox({ modelValue: UUID, leagueId: 'l1', answerLabel: 'Old name' })
    await flushPromises()

    const input = wrapper.find('input').element as HTMLInputElement
    expect(input.value).toBe('Vinicius Jr.')
  })

  it('renders the team flag inside the input when selected player has teamFlagUrl', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Vinicius Jr.', teamId: 't1', teamName: 'Brazil', teamShortCode: 'BRA', teamFlagUrl: 'https://example.com/br.svg' },
    ])
    const wrapper = mountCombobox({ modelValue: UUID, leagueId: 'l1', answerLabel: null })
    await flushPromises()

    const flag = wrapper.find('img')
    expect(flag.exists()).toBe(true)
    expect(flag.attributes('src')).toBe('https://example.com/br.svg')
    expect(flag.attributes('alt')).toBe('Brazil')
  })

  it('does not render a flag when no player is selected', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Vinicius Jr.', teamId: 't1', teamName: 'Brazil', teamShortCode: 'BRA', teamFlagUrl: 'https://example.com/br.svg' },
    ])
    const wrapper = mountCombobox({ modelValue: null, leagueId: 'l1', answerLabel: null })
    await flushPromises()

    expect(wrapper.find('img').exists()).toBe(false)
  })

  // ─── SCORER-002 prop extensions ─────────────────────────────────────────────

  it('restrictToTeams: loads only players of the specified teams (two API calls)', async () => {
    const HOME = { id: 't-home', name: 'Magyarország', shortCode: 'HUN', flagUrl: null }
    const AWAY = { id: 't-away', name: 'Argentína', shortCode: 'ARG', flagUrl: null }
    playersListMock.mockImplementation(async (_token: string, _leagueId?: string, teamId?: string) => {
      if (teamId === 't-home') return [{ id: 'p1', name: 'Szoboszlai D.', teamId: 't-home', teamName: 'Magyarország', teamShortCode: 'HUN' }]
      if (teamId === 't-away') return [{ id: 'p2', name: 'Messi L.', teamId: 't-away', teamName: 'Argentína', teamShortCode: 'ARG' }]
      return []
    })
    const wrapper = mountCombobox({
      modelValue: null,
      restrictToTeams: [HOME, AWAY],
    })
    await flushPromises()

    expect(playersListMock).toHaveBeenCalledTimes(2)
    expect(playersListMock).toHaveBeenCalledWith(expect.any(String), undefined, 't-home')
    expect(playersListMock).toHaveBeenCalledWith(expect.any(String), undefined, 't-away')

    const input = wrapper.find('input').element as HTMLInputElement
    await wrapper.find('input').trigger('focus')
    await flushPromises()

    const items = wrapper.findAll('li')
    const itemNames = items.map(li => li.text())
    expect(itemNames.some(t => t.includes('Szoboszlai'))).toBe(true)
    expect(itemNames.some(t => t.includes('Messi'))).toBe(true)
    expect(input.value).toBe('')
  })

  it('restrictToTeams: the dropdown groups by team with headers', async () => {
    const HOME = { id: 't-home', name: 'Magyarország', shortCode: 'HUN', flagUrl: 'hun.svg' }
    const AWAY = { id: 't-away', name: 'Argentína', shortCode: 'ARG', flagUrl: 'arg.svg' }
    playersListMock.mockImplementation(async (_t: string, _l?: string, teamId?: string) => {
      if (teamId === 't-home') return [{ id: 'p1', name: 'Szoboszlai D.', teamId: 't-home', teamName: 'Magyarország', teamShortCode: 'HUN' }]
      if (teamId === 't-away') return [{ id: 'p2', name: 'Messi L.', teamId: 't-away', teamName: 'Argentína', teamShortCode: 'ARG' }]
      return []
    })
    const wrapper = mountCombobox({ modelValue: null, restrictToTeams: [HOME, AWAY] })
    await flushPromises()

    await wrapper.find('input').trigger('focus')
    await flushPromises()

    const groupHeaders = wrapper.findAll('[role="group"] [data-team-group-header]')
    expect(groupHeaders.length).toBe(2)
    expect(groupHeaders[0]?.text()).toContain('Magyarország')
    expect(groupHeaders[1]?.text()).toContain('Argentína')
  })

  it('allowExplicitClear: a "clear" row appears at the bottom of the dropdown when a value is selected', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Vinicius Jr.', teamId: 't1', teamName: 'Brazil', teamShortCode: 'BRA' },
    ])
    const wrapper = mountCombobox({ modelValue: UUID, leagueId: 'l1', allowExplicitClear: true })
    await flushPromises()

    await wrapper.find('input').trigger('focus')
    await flushPromises()

    const clearItem = wrapper.find('[data-clear-row]')
    expect(clearItem.exists()).toBe(true)
  })

  it('allowExplicitClear: clicking the "clear" row empties modelValue to null', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Vinicius Jr.', teamId: 't1', teamName: 'Brazil', teamShortCode: 'BRA' },
    ])
    const wrapper = mountCombobox({ modelValue: UUID, leagueId: 'l1', allowExplicitClear: true })
    await flushPromises()

    await wrapper.find('input').trigger('focus')
    await flushPromises()

    await wrapper.find('[data-clear-row]').trigger('mousedown')
    const events = wrapper.emitted('update:modelValue') as Array<[string | null]>
    expect(events?.[events.length - 1]?.[0]).toBeNull()
  })

  it('showPlayerMeta=true: position + shirt number appear in the row', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Szoboszlai D.', teamId: 't1', teamName: 'HUN', teamShortCode: 'HUN', position: 'FW', shirtNumber: 10 },
    ])
    const wrapper = mountCombobox({ modelValue: null, leagueId: 'l1', showPlayerMeta: true })
    await flushPromises()

    await wrapper.find('input').trigger('focus')
    await flushPromises()

    const li = wrapper.find('li')
    expect(li.text()).toContain('FW')
    expect(li.text()).toContain('#10')
  })

  it('showPlayerMeta=false (default): position and shirt number are not rendered', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'Szoboszlai D.', teamId: 't1', teamName: 'HUN', teamShortCode: 'HUN', position: 'FW', shirtNumber: 10 },
    ])
    const wrapper = mountCombobox({ modelValue: null, leagueId: 'l1' })
    await flushPromises()

    await wrapper.find('input').trigger('focus')
    await flushPromises()

    const li = wrapper.find('li')
    expect(li.text()).not.toContain('#10')
  })

  it('size=compact: trigger height is h-8', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'X', teamId: 't1', teamName: 'T', teamShortCode: 'T' },
    ])
    const wrapper = mountCombobox({ modelValue: null, leagueId: 'l1', size: 'compact' })
    await flushPromises()

    const trigger = wrapper.find('[data-trigger]')
    expect(trigger.classes()).toContain('h-8')
  })

  it('size=comfortable: trigger height is h-10', async () => {
    playersListMock.mockResolvedValue([
      { id: UUID, name: 'X', teamId: 't1', teamName: 'T', teamShortCode: 'T' },
    ])
    const wrapper = mountCombobox({ modelValue: null, leagueId: 'l1', size: 'comfortable' })
    await flushPromises()

    const trigger = wrapper.find('[data-trigger]')
    expect(trigger.classes()).toContain('h-10')
  })
})
