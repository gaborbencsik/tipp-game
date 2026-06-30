import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BracketRoundTeamList from './BracketRoundTeamList.vue'
import type { AllGroupsStandingAnswer, BracketProgressionOptions } from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) } },
}))

const teamsListMock = vi.fn()
vi.mock('@/api/index', () => ({
  api: { teams: { list: (...args: unknown[]) => teamsListMock(...args) } },
}))

const A1 = 'aaaa-1', A2 = 'aaaa-2'
const B1 = 'bbbb-1', B2 = 'bbbb-2'
const C1 = 'cccc-1', D1 = 'dddd-1'

const TEAM_NAMES = new Map<string, string>([
  [A1, 'Team A1'],
  [A2, 'Team A2'],
  [B1, 'Team B1'],
  [B2, 'Team B2'],
  [C1, 'Team C1'],
  [D1, 'Team D1'],
])

const TINY_OPTIONS: BracketProgressionOptions = {
  bracketTemplate: {
    matches: [
      { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: 'l16_m1' },
      { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'W_D1', winnerTo: 'l16_m1' },
      { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
      { id: 'final',  round: 'final',  slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
      { id: 'bronze', round: 'bronze', slotA: '<l16_m1_loser>', slotB: '<l16_m1_loser>', winnerTo: null },
    ],
  },
}

const STANDINGS: AllGroupsStandingAnswer = {
  groups: {
    A: [A1, A2, 'a3', 'a4'],
    B: [B1, B2, 'b3', 'b4'],
    C: [C1, 'c2', 'c3', 'c4'],
    D: [D1, 'd2', 'd3', 'd4'],
  },
  best3rds: [],
}

beforeEach(() => {
  teamsListMock.mockReset()
  teamsListMock.mockResolvedValue([])
  setActivePinia(createPinia())
})

const baseProps = {
  options: TINY_OPTIONS,
  correctGroupStandings: STANDINGS,
  currentAnswerJson: null as string | null,
  busy: false,
  teamNameById: TEAM_NAMES,
}

describe('BracketRoundTeamList — rendering', () => {
  it('renders a section for each of the 6 bracket rounds', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const sections = wrapper.findAll('[data-testid^="round-section-"]')
    const ids = sections.map(s => s.attributes('data-testid'))
    expect(ids).toEqual([
      'round-section-last_32',
      'round-section-last_16',
      'round-section-qf',
      'round-section-sf',
      'round-section-final',
      'round-section-bronze',
    ])
  })

  it('shows a missing-standings warning when correctGroupStandings is null', async () => {
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, correctGroupStandings: null },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Csoport végeredmény')
  })
})

describe('BracketRoundTeamList — last_32 selection', () => {
  it('lists last_32 participants (slotA + slotB across matches) as chips', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-last_32"] [data-testid^="team-chip-"]')
    const teamIds = chips.map(c => c.attributes('data-team-id')).sort()
    expect(teamIds).toEqual([A1, B2, C1, D1].sort())
  })

  it('toggles selection state on chip click', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const chip = wrapper.find(`[data-testid="round-section-last_32"] [data-team-id="${A1}"]`)
    expect(chip.attributes('data-selected')).toBe('false')
    await chip.trigger('click')
    expect(chip.attributes('data-selected')).toBe('true')
    await chip.trigger('click')
    expect(chip.attributes('data-selected')).toBe('false')
  })

  it('emits save with the winners derived from chip selection', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    await wrapper.find(`[data-testid="round-section-last_32"] [data-team-id="${A1}"]`).trigger('click')
    await wrapper.find(`[data-testid="round-section-last_32"] [data-team-id="${D1}"]`).trigger('click')
    await wrapper.find('[data-testid="save-last_32"]').trigger('click')

    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeTruthy()
    expect(saveEvents!.length).toBe(1)
    const [round, answer] = saveEvents![0] as [string, { winners: Record<string, string> }]
    expect(round).toBe('last_32')
    expect(answer.winners).toEqual({ l32_m1: A1, l32_m2: D1 })
  })
})

describe('BracketRoundTeamList — cascade gating', () => {
  it('disables later rounds until upstream winners exist', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const last16 = wrapper.find('[data-testid="round-section-last_16"]')
    expect(last16.attributes('data-locked')).toBe('true')
  })

  it('enables last_16 once last_32 winners are present', async () => {
    const answer = JSON.stringify({ winners: { l32_m1: A1, l32_m2: D1 } })
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentAnswerJson: answer },
    })
    await flushPromises()
    const last16 = wrapper.find('[data-testid="round-section-last_16"]')
    expect(last16.attributes('data-locked')).toBe('false')
    const chips = wrapper.findAll('[data-testid="round-section-last_16"] [data-testid^="team-chip-"]')
    const ids = chips.map(c => c.attributes('data-team-id')).sort()
    expect(ids).toEqual([A1, D1].sort())
  })
})

describe('BracketRoundTeamList — bronze', () => {
  it('shows the two SF losers as the bronze pool', async () => {
    // l16_m1 winner=A1 (so C1 is its loser). bronze pairs <l16_m1_loser> with itself.
    const answer = JSON.stringify({ winners: { l32_m1: A1, l32_m2: C1, l16_m1: A1 } })
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentAnswerJson: answer },
    })
    await flushPromises()
    const bronze = wrapper.find('[data-testid="round-section-bronze"]')
    expect(bronze.attributes('data-locked')).toBe('false')
    const chips = bronze.findAll('[data-testid^="team-chip-"]')
    expect(chips.length).toBeGreaterThan(0)
    const ids = chips.map(c => c.attributes('data-team-id'))
    expect(ids).toContain(C1)
  })
})
