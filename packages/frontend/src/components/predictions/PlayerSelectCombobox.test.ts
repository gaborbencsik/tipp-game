import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlayerSelectCombobox from './PlayerSelectCombobox.vue'
import { buildTestI18n } from '@/test-utils/i18n'

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

function mountCombobox(props: { modelValue: string | null; leagueId?: string | null; answerLabel?: string | null }) {
  return mount(PlayerSelectCombobox, {
    props,
    global: { plugins: [buildTestI18n()] },
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
})
