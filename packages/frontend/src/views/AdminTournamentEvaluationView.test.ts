import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminTournamentEvaluationView from '@/views/AdminTournamentEvaluationView.vue'
import type { SpecialPredictionType } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockGetSession,
  mockGlobalTypesList,
  mockSetCorrectAnswer,
  mockEvaluate,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockGlobalTypesList: vi.fn().mockResolvedValue([]),
  mockSetCorrectAnswer: vi.fn(),
  mockEvaluate: vi.fn(),
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
    health: vi.fn(),
    auth: { me: vi.fn() },
    matches: { list: vi.fn() },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    teams: { list: vi.fn().mockResolvedValue([]) },
    admin: {
      globalSpecialTypes: {
        list: mockGlobalTypesList,
        setCorrectAnswer: mockSetCorrectAnswer,
        evaluate: mockEvaluate,
      },
    },
  },
}))

const TEXT_TYPE: SpecialPredictionType = {
  id: 'type-1',
  groupId: null,
  name: 'Torna gólkirály',
  description: null,
  inputType: 'text',
  options: null,
  deadline: '2026-07-01T00:00:00.000Z',
  points: 10,
  correctAnswer: null,
  isGlobal: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const GROUP_STANDING_TYPE: SpecialPredictionType = {
  id: 'type-2',
  groupId: null,
  name: 'Csoport végeredmény',
  description: 'Tippeld meg a 12 csoport sorrendjét.',
  inputType: 'all_groups_standing',
  options: { groups: ['A', 'B', 'C'], teamsPerGroup: 4, best3rdPicks: 0 } as unknown as SpecialPredictionType['options'],
  deadline: '2026-07-01T00:00:00.000Z',
  points: 0,
  correctAnswer: null,
  isGlobal: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildRouter() {
  return buildTestRouter({ '/admin/tournament-evaluation': AdminTournamentEvaluationView })
}

async function mountView(types: SpecialPredictionType[] = []) {
  mockGlobalTypesList.mockResolvedValue(types)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminTournamentEvaluationView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper }
}

describe('AdminTournamentEvaluationView', () => {
  beforeEach(() => {
    mockGlobalTypesList.mockReset()
    mockGlobalTypesList.mockResolvedValue([])
    mockSetCorrectAnswer.mockReset()
    mockSetCorrectAnswer.mockImplementation((_t, id, answer) => Promise.resolve({ ...TEXT_TYPE, id, correctAnswer: answer }))
    mockEvaluate.mockReset()
    mockEvaluate.mockResolvedValue({ evaluatedCount: 5, totalPoints: 50, lastRunAt: '2026-06-12T20:00:00.000Z' })
    setActivePinia(createPinia())
  })

  it('renders the heading and an empty-state when no types exist', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.text()).toContain('Torna-tipp kiértékelés')
    expect(wrapper.text()).toContain('Még nincs hivatalos speciális tipp típus.')
  })

  it('renders one card per active global type', async () => {
    const { wrapper } = await mountView([TEXT_TYPE, GROUP_STANDING_TYPE])
    const cards = wrapper.findAll('[data-testid="tournament-evaluation-type"]')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Torna gólkirály')
    expect(cards[1].text()).toContain('Csoport végeredmény')
  })

  it('shows per-group slice buttons for an all_groups_standing type', async () => {
    const { wrapper } = await mountView([GROUP_STANDING_TYPE])
    expect(wrapper.text()).toContain('A csoport')
    expect(wrapper.text()).toContain('B csoport')
    expect(wrapper.text()).toContain('C csoport')
    expect(wrapper.text()).toContain('Mind kiértékelése')
  })

  it('calls setCorrectAnswer + evaluate(null) when the simple type save button is clicked', async () => {
    const { wrapper } = await mountView([TEXT_TYPE])
    const input = wrapper.find('input[type="text"]')
    await input.setValue('Messi')
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Mentés és kiértékelés'))
    expect(saveBtn).toBeDefined()
    await saveBtn!.trigger('click')
    await flushPromises()
    expect(mockSetCorrectAnswer).toHaveBeenCalledWith('mock-token', 'type-1', 'Messi')
    expect(mockEvaluate).toHaveBeenCalledWith('mock-token', 'type-1', null)
  })

  it('renders auto-derive notice (no JSON input) for multi_team_weighted type', async () => {
    const upsetType: SpecialPredictionType = {
      ...TEXT_TYPE,
      id: 'type-3',
      name: 'Biztos kieső',
      inputType: 'multi_team_weighted',
      options: { maxPicks: 2, minPicks: 2, choices: [] } as unknown as SpecialPredictionType['options'],
    }
    // 8 fake best3rd UUIDs so the prereq check passes.
    const best3rds = Array.from({ length: 8 }, (_, i) => `team-${i}-uuid`)
    const groupType: SpecialPredictionType = {
      ...GROUP_STANDING_TYPE,
      correctAnswer: JSON.stringify({ groups: {}, best3rds }),
    }
    const { wrapper } = await mountView([upsetType, groupType])
    expect(wrapper.text()).toContain('automatikusan származtatódnak')
    // No textarea or text input on this card.
    const card = wrapper.findAll('[data-testid="tournament-evaluation-type"]').find(c => c.attributes('data-type-id') === 'type-3')!
    expect(card.find('textarea').exists()).toBe(false)
    expect(card.find('input[type="text"]').exists()).toBe(false)
    // Eval-only button works without prior setCorrectAnswer call.
    const evalBtn = card.findAll('button').find(b => b.text().includes('Kiértékelés (auto-derive)'))
    expect(evalBtn).toBeDefined()
    expect(evalBtn!.attributes('disabled')).toBeUndefined()
    await evalBtn!.trigger('click')
    await flushPromises()
    expect(mockSetCorrectAnswer).not.toHaveBeenCalled()
    expect(mockEvaluate).toHaveBeenCalledWith('mock-token', 'type-3', null)
  })

  it('disables the auto-derive button and shows a prereq warning when group standings are missing', async () => {
    const upsetType: SpecialPredictionType = {
      ...TEXT_TYPE,
      id: 'type-3',
      name: 'Biztos kieső',
      inputType: 'multi_team_weighted',
      options: { maxPicks: 2, minPicks: 2, choices: [] } as unknown as SpecialPredictionType['options'],
    }
    // No GROUP_STANDING_TYPE → prereq missing.
    const { wrapper } = await mountView([upsetType])
    const card = wrapper.findAll('[data-testid="tournament-evaluation-type"]').find(c => c.attributes('data-type-id') === 'type-3')!
    expect(card.text()).toContain('Előfeltétel hiányzik')
    expect(card.text()).toContain('Csoport végeredmény')
    const evalBtn = card.findAll('button').find(b => b.text().includes('Kiértékelés (auto-derive)'))!
    expect(evalBtn.attributes('disabled')).toBeDefined()
    await evalBtn.trigger('click')
    await flushPromises()
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('calls evaluate with a slice when the per-group button is clicked', async () => {
    const withAnswer = { ...GROUP_STANDING_TYPE, correctAnswer: '{"groups":{},"best3rds":[]}' }
    const { wrapper } = await mountView([withAnswer])
    await flushPromises()
    const groupBtn = wrapper.findAll('button').find(b => b.text().trim() === 'A csoport')
    expect(groupBtn).toBeDefined()
    await groupBtn!.trigger('click')
    await flushPromises()
    expect(mockEvaluate).toHaveBeenCalledWith('mock-token', 'type-2', 'group_A')
  })
})
