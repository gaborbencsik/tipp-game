import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BracketProgressionPicker from './BracketProgressionPicker.vue'
import type { AllGroupsStandingAnswer, BracketProgressionOptions } from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) } },
}))

const teamsListMock = vi.fn()
vi.mock('@/api/index', () => ({
  api: { teams: { list: (...args: unknown[]) => teamsListMock(...args) } },
}))

const A1 = 'aaaa-1', A2 = 'aaaa-2', B1 = 'bbbb-1', B2 = 'bbbb-2'
const C1 = 'cccc-1', D1 = 'dddd-1', E1 = 'eeee-1', F1 = 'ffff-1', G1 = 'gggg-1', H1 = 'hhhh-1'

const TINY_OPTIONS: BracketProgressionOptions = {
  bracketTemplate: {
    matches: [
      { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'RU_B1', winnerTo: 'l16_m1' },
      { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'W_D1', winnerTo: 'l16_m1' },
      { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: null },
      { id: 'final',  round: 'final',  slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: null },
      { id: 'bronze', round: 'bronze', slotA: '<l16_m1_loser>', slotB: '<l16_m1_loser>', winnerTo: null },
    ],
  },
}

const FULL_STANDINGS: AllGroupsStandingAnswer = {
  groups: {
    A: [A1, A2, 'a3', 'a4'],
    B: [B1, B2, 'b3', 'b4'],
    C: [C1, 'c2', 'c3', 'c4'],
    D: [D1, 'd2', 'd3', 'd4'],
    E: [E1, 'e2', 'e3', 'e4'],
    F: [F1, 'f2', 'f3', 'f4'],
    G: [G1, 'g2', 'g3', 'g4'],
    H: [H1, 'h2', 'h3', 'h4'],
  },
  best3rds: ['a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3'],
}

beforeEach(() => {
  teamsListMock.mockReset()
  teamsListMock.mockResolvedValue([
    { id: A1, name: 'A1', shortCode: 'A1', flagUrl: null, group: 'A', teamType: 'national', countryCode: null },
    { id: A2, name: 'A2', shortCode: 'A2', flagUrl: null, group: 'A', teamType: 'national', countryCode: null },
    { id: B2, name: 'B2', shortCode: 'B2', flagUrl: null, group: 'B', teamType: 'national', countryCode: null },
    { id: C1, name: 'C1', shortCode: 'C1', flagUrl: null, group: 'C', teamType: 'national', countryCode: null },
    { id: D1, name: 'D1', shortCode: 'D1', flagUrl: null, group: 'D', teamType: 'national', countryCode: null },
  ])
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

describe('BracketProgressionPicker', () => {
  it('renders the gate when groupStandingsAnswer is null', async () => {
    const wrapper = mount(BracketProgressionPicker, {
      props: { options: TINY_OPTIONS, answer: null, groupStandingsAnswer: null },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="bracket-progression-gate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bracket-round-last_32"]').exists()).toBe(false)
  })

  it('renders the rounds when groupStandingsAnswer is provided', async () => {
    const wrapper = mount(BracketProgressionPicker, {
      props: { options: TINY_OPTIONS, answer: null, groupStandingsAnswer: FULL_STANDINGS },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="bracket-progression-gate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="bracket-round-last_32"]').exists()).toBe(true)
  })

  it('emits submit on pick (after debounce)', async () => {
    const wrapper = mount(BracketProgressionPicker, {
      props: { options: TINY_OPTIONS, answer: null, groupStandingsAnswer: FULL_STANDINGS },
    })
    await flushPromises()
    // Click the team A1 in match l32_m1 (slotA)
    const m1 = wrapper.find('[data-testid="bracket-match-l32_m1"]')
    expect(m1.exists()).toBe(true)
    const buttons = m1.findAll('button')
    expect(buttons.length).toBe(2)
    await buttons[0].trigger('click')
    await vi.advanceTimersByTimeAsync(450)
    const events = wrapper.emitted('submit')
    expect(events).toBeTruthy()
    const payload = JSON.parse(events![0][0] as string)
    expect(payload.winners.l32_m1).toBe(A1)
  })

  it('cascades downstream invalidation on pick swap', async () => {
    // Pre-load: l32_m1 winner = A1, l16_m1 winner = A1.
    // Then change l32_m1 to B2 → l16_m1 should clear.
    const initial = JSON.stringify({ winners: { l32_m1: A1, l16_m1: A1 } })
    const wrapper = mount(BracketProgressionPicker, {
      props: { options: TINY_OPTIONS, answer: initial, groupStandingsAnswer: FULL_STANDINGS },
    })
    await flushPromises()
    const m1 = wrapper.find('[data-testid="bracket-match-l32_m1"]')
    const buttons = m1.findAll('button')
    // Click B2 (slotB)
    await buttons[1].trigger('click')
    await vi.advanceTimersByTimeAsync(450)
    const events = wrapper.emitted('submit')
    const payload = JSON.parse(events!.at(-1)![0] as string)
    expect(payload.winners.l32_m1).toBe(B2)
    expect(payload.winners.l16_m1).toBeUndefined()
  })
})
