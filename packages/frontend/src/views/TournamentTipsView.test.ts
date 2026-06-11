import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TournamentTipsView from '@/views/TournamentTipsView.vue'
import { useTournamentTipsStore } from '@/stores/tournamentTips.store'
import type { SpecialPredictionWithType } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockGetSession, mockTournamentTipsList, mockTournamentTipsUpsert, mockTournamentTipsAccess } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
  mockTournamentTipsList: vi.fn(),
  mockTournamentTipsUpsert: vi.fn(),
  mockTournamentTipsAccess: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    tournamentTips: {
      list: mockTournamentTipsList,
      upsert: mockTournamentTipsUpsert,
      access: mockTournamentTipsAccess,
    },
  },
}))

vi.mock('@/components/AppLayout.vue', () => ({
  default: { template: '<div><slot /></div>' },
}))

vi.mock('@/components/predictions/TeamSelectDropdown.vue', () => ({
  default: { template: '<div data-testid="team-select-stub" />' },
}))

vi.mock('@/components/predictions/PlayerSelectCombobox.vue', () => ({
  default: { template: '<div data-testid="player-select-stub" />' },
}))

const FUTURE_DEADLINE = '2099-07-01T00:00:00.000Z'
const PAST_DEADLINE = '2020-01-01T00:00:00.000Z'

const TIP_OPEN_TEXT: SpecialPredictionWithType = {
  id: null,
  typeId: 'type-text',
  typeName: 'Tournament champion',
  typeDescription: 'Pick the winner',
  inputType: 'text',
  options: null,
  deadline: FUTURE_DEADLINE,
  maxPoints: 25,
  answer: null,
  answerLabel: null,
  points: null,
  correctAnswer: null,
  correctAnswerLabel: null,
  isGlobal: true,
  createdAt: null,
  updatedAt: null,
}

const TIP_OPEN_DROPDOWN: SpecialPredictionWithType = {
  ...TIP_OPEN_TEXT,
  typeId: 'type-dd',
  typeName: 'Top scorer count',
  inputType: 'dropdown',
  options: ['1-3', '4-6', '7+'],
}

const TIP_OPEN_TEAM: SpecialPredictionWithType = {
  ...TIP_OPEN_TEXT,
  typeId: 'type-team',
  typeName: 'Group A winner',
  inputType: 'team_select',
}

const TIP_OPEN_PLAYER: SpecialPredictionWithType = {
  ...TIP_OPEN_TEXT,
  typeId: 'type-player',
  typeName: 'Top scorer',
  inputType: 'player_select',
}

const TIP_SCORED: SpecialPredictionWithType = {
  ...TIP_OPEN_TEXT,
  typeId: 'type-scored',
  id: 'pred-1',
  answer: 'Argentina',
  answerLabel: 'Argentina',
  points: 25,
  correctAnswer: 'Argentina',
  correctAnswerLabel: 'Argentina',
  deadline: PAST_DEADLINE,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

// UX-032: deadline lejárt, de pont nincs kiértékelve → read-only lock.
const TIP_LOCKED_DROPDOWN: SpecialPredictionWithType = {
  ...TIP_OPEN_DROPDOWN,
  typeId: 'type-locked-dd',
  deadline: PAST_DEADLINE,
  answer: '4-6',
  answerLabel: '4-6',
  points: null,
}

function buildRouter() {
  return buildTestRouter({ '/app/tournament-tips': TournamentTipsView })
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(TournamentTipsView, {
    global: { plugins: [pinia, buildRouter()] },
  })
  await flushPromises()
  return { wrapper, store: useTournamentTipsStore() }
}

describe('TournamentTipsView', () => {
  beforeEach(() => {
    mockTournamentTipsList.mockReset()
    mockTournamentTipsUpsert.mockReset()
    mockTournamentTipsAccess.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  })

  it('shows no-access state when fetchTips returns 403', async () => {
    mockTournamentTipsList.mockRejectedValueOnce(new Error('No tournament access — join a group with the WC league first'))
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="tournament-tips-no-access"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tournament-tips-list"]').exists()).toBe(false)
  })

  it('shows loading state before fetch resolves', async () => {
    let resolveList: (v: SpecialPredictionWithType[]) => void = () => {}
    mockTournamentTipsList.mockReturnValueOnce(new Promise(r => { resolveList = r }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(TournamentTipsView, {
      global: { plugins: [pinia, buildRouter()] },
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="tournament-tips-loading"]').exists()).toBe(true)
    resolveList([])
    await flushPromises()
  })

  it('shows error state when fetch fails', async () => {
    mockTournamentTipsList.mockRejectedValueOnce(new Error('Boom'))
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="tournament-tips-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Boom')
  })

  it('shows empty state when no tips returned', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([])
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="tournament-tips-empty"]').exists()).toBe(true)
  })

  it('renders all tips with correct testid', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_TEXT, TIP_OPEN_DROPDOWN, TIP_SCORED])
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="tournament-tips-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tournament-tip-type-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tournament-tip-type-dd"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tournament-tip-type-scored"]').exists()).toBe(true)
  })

  it('renders TeamSelectDropdown for team_select tips', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_TEAM])
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="team-select-stub"]').exists()).toBe(true)
  })

  it('renders PlayerSelectCombobox for player_select tips', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_PLAYER])
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="player-select-stub"]').exists()).toBe(true)
  })

  it('renders dropdown options for dropdown inputType', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_DROPDOWN])
    const { wrapper } = await mountView()
    const opts = wrapper.findAll('option')
    const labels = opts.map(o => o.text())
    expect(labels).toContain('1-3')
    expect(labels).toContain('4-6')
    expect(labels).toContain('7+')
  })

  it('renders text input as fallback for text inputType', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_TEXT])
    const { wrapper } = await mountView()
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('shows points and correct answer when scored', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_SCORED])
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Argentina')
    expect(wrapper.text()).toContain('25')
  })

  it('calls store.upsertTip when dropdown changes', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_DROPDOWN])
    mockTournamentTipsUpsert.mockResolvedValueOnce({ ...TIP_OPEN_DROPDOWN, answer: '4-6' })
    const { wrapper } = await mountView()
    const select = wrapper.find('select')
    await select.setValue('4-6')
    await flushPromises()
    expect(mockTournamentTipsUpsert).toHaveBeenCalledWith('tok', { typeId: 'type-dd', answer: '4-6' })
  })

  // UX-032: read-only lock state
  describe('UX-032 read-only lock when deadline passed and points unscored', () => {
    it('open + future deadline → no lock banner, no lock wrapper', async () => {
      mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN_DROPDOWN])
      const { wrapper } = await mountView()
      expect(wrapper.find('[data-testid="tip-locked-banner"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="tip-locked-wrapper"]').exists()).toBe(false)
    })

    it('past deadline + points: null → lock banner + dimmed wrapper, picker still rendered', async () => {
      mockTournamentTipsList.mockResolvedValueOnce([TIP_LOCKED_DROPDOWN])
      const { wrapper } = await mountView()
      const card = wrapper.find('[data-testid="tournament-tip-type-locked-dd"]')
      expect(card.find('[data-testid="tip-locked-banner"]').exists()).toBe(true)
      const lockWrapper = card.find('[data-testid="tip-locked-wrapper"]')
      expect(lockWrapper.exists()).toBe(true)
      expect(lockWrapper.classes()).toContain('pointer-events-none')
      expect(lockWrapper.classes()).toContain('opacity-60')
      expect(lockWrapper.attributes('aria-disabled')).toBe('true')
      // Picker (the dropdown <select>) is still rendered inside the lock wrapper.
      expect(card.find('select').exists()).toBe(true)
      // Existing answer surfaced as an explicit summary line for simple tips.
      expect(card.find('[data-testid="tip-locked-answer"]').text()).toContain('4-6')
    })

    it('past deadline + points scored → result block, no lock banner, no picker', async () => {
      mockTournamentTipsList.mockResolvedValueOnce([TIP_SCORED])
      const { wrapper } = await mountView()
      const card = wrapper.find('[data-testid="tournament-tip-type-scored"]')
      expect(card.find('[data-testid="tip-locked-banner"]').exists()).toBe(false)
      expect(card.find('[data-testid="tip-locked-wrapper"]').exists()).toBe(false)
      expect(card.find('input[type="text"]').exists()).toBe(false)
      expect(card.text()).toContain('Argentina')
      expect(card.text()).toContain('25')
    })
  })
})
