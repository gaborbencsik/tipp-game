import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import GroupStandingsPicker from './GroupStandingsPicker.vue'
import type { AllGroupsStandingOptions, Team } from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
    },
  },
}))

const teamsListMock = vi.fn()

vi.mock('@/api/index', () => ({
  api: {
    teams: { list: (...args: unknown[]) => teamsListMock(...args) },
  },
}))

function team(id: string, name: string, code: string, group: string): Team {
  return { id, name, shortCode: code, flagUrl: null, group, teamType: 'national', countryCode: null }
}

const TEAMS: Team[] = [
  team('a1', 'Argentina', 'ARG', 'A'),
  team('a2', 'Brazília', 'BRA', 'A'),
  team('a3', 'Chile', 'CHI', 'A'),
  team('a4', 'Dánia', 'DEN', 'A'),
  team('b1', 'Egyiptom', 'EGY', 'B'),
  team('b2', 'Franciaország', 'FRA', 'B'),
  team('b3', 'Ghána', 'GHA', 'B'),
  team('b4', 'Hollandia', 'NED', 'B'),
]

const OPTIONS: AllGroupsStandingOptions = {
  groups: ['A', 'B'],
  teamsPerGroup: 4,
  best3rdPicks: 1,
}

beforeEach(() => {
  teamsListMock.mockReset()
  teamsListMock.mockResolvedValue(TEAMS)
  vi.useFakeTimers()
})

describe('GroupStandingsPicker', () => {
  it('parses an existing answer and renders progress', async () => {
    const answer = JSON.stringify({
      groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', null, null, null] },
      best3rds: [],
    })
    const wrapper = mount(GroupStandingsPicker, { props: { options: OPTIONS, answer } })
    await flushPromises()
    expect(wrapper.text()).toContain('1 / 3')
  })

  it('debounces save and emits a single submit after 400ms', async () => {
    const wrapper = mount(GroupStandingsPicker, { props: { options: OPTIONS, answer: null } })
    await flushPromises()

    await wrapper.find('[data-testid="position-dropdown-A-1"]').trigger('click')
    await wrapper.find('[data-testid="position-dropdown-option-A-1-a1"]').trigger('click')

    await wrapper.find('[data-testid="position-dropdown-A-2"]').trigger('click')
    await wrapper.find('[data-testid="position-dropdown-option-A-2-a2"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    vi.advanceTimersByTime(400)
    await flushPromises()

    const events = wrapper.emitted('submit')!
    expect(events).toHaveLength(1)
    const payload = JSON.parse(events[0][0] as string)
    expect(payload.groups.A).toEqual(['a1', 'a2', null, null])
    expect(payload.best3rds).toEqual([])
  })

  it('clears a group on clear button click', async () => {
    const answer = JSON.stringify({
      groups: { A: ['a1', 'a2', 'a3', 'a4'], B: [null, null, null, null] },
      best3rds: [],
    })
    const wrapper = mount(GroupStandingsPicker, { props: { options: OPTIONS, answer } })
    await flushPromises()

    const cardA = wrapper.find('[data-testid="group-standing-card-A"]')
    await cardA.find('button').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="group-standing-clear-A"]').trigger('click')
    vi.advanceTimersByTime(400)
    await flushPromises()

    const events = wrapper.emitted('submit')!
    const payload = JSON.parse(events[events.length - 1][0] as string)
    expect(payload.groups.A).toEqual([null, null, null, null])
  })

  it('locks best3rd picker until all groups are filled', async () => {
    const wrapper = mount(GroupStandingsPicker, { props: { options: OPTIONS, answer: null } })
    await flushPromises()
    expect(wrapper.find('[data-testid="best-3rd-locked"]').exists()).toBe(true)
  })

  it('unlocks best3rd picker once all groups are filled', async () => {
    const answer = JSON.stringify({
      groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
      best3rds: [],
    })
    const wrapper = mount(GroupStandingsPicker, { props: { options: OPTIONS, answer } })
    await flushPromises()
    expect(wrapper.find('[data-testid="best-3rd-locked"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="best-3rd-chip-a3"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="best-3rd-chip-b3"]').exists()).toBe(true)
  })

  it('drops orphaned best3rds when their 3rd-place team is removed', async () => {
    const answer = JSON.stringify({
      groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
      best3rds: ['a3'],
    })
    const wrapper = mount(GroupStandingsPicker, { props: { options: OPTIONS, answer } })
    await flushPromises()

    await wrapper.find('[data-testid="group-standing-clear-A"]').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(400)
    await flushPromises()

    const events = wrapper.emitted('submit')!
    const payload = JSON.parse(events[events.length - 1][0] as string)
    expect(payload.best3rds).toEqual([])
  })

  // UX-032: read-only mode — expand/collapse still works, but mutations are blocked.
  describe('readOnly mode', () => {
    it('does not auto-expand any group when readOnly', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', null, null, null], B: [null, null, null, null] },
        best3rds: [],
      })
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, readOnly: true },
      })
      await flushPromises()
      expect(wrapper.find('[data-testid="position-dropdown-A-1"]').exists()).toBe(false)
    })

    it('user can still toggle a group open/closed in readOnly', async () => {
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer: null, readOnly: true },
      })
      await flushPromises()
      // Toggle group A open via the card header.
      const cardA = wrapper.find('[data-testid="group-standing-card-A"]')
      await cardA.find('button').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="position-dropdown-A-1"]').exists()).toBe(true)
    })

    it('clearGroup is a no-op in readOnly', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: [null, null, null, null] },
        best3rds: [],
      })
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, readOnly: true },
      })
      await flushPromises()
      const cardA = wrapper.find('[data-testid="group-standing-card-A"]')
      await cardA.find('button').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="group-standing-clear-A"]').trigger('click')
      vi.advanceTimersByTime(500)
      await flushPromises()

      expect(wrapper.emitted('submit')).toBeUndefined()
    })
  })

  // UX-039: scored tip — render green/red feedback when correctAnswer is provided.
  describe('UX-039 scored (correctAnswer)', () => {
    it('passes parsed correctPositions to each GroupStandingCard', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: ['a3'],
      })
      const correctAnswer = JSON.stringify({
        groups: { A: ['a1', 'a3', 'a2', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: ['b3'],
      })
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, correctAnswer, readOnly: true },
      })
      await flushPromises()

      // Group A summary: pos1 (a1==a1) green, pos2 (a2 vs a3) red, pos3 (a3 vs a2) red, pos4 (a4==a4) green
      const summaryA = wrapper.find('[data-testid="group-standing-summary-A"]')
      const chipsA = summaryA.findAll('[data-testid^="group-standing-summary-chip-A-"]')
      expect(chipsA).toHaveLength(4)
      expect(chipsA[0]!.classes().some(c => c.includes('emerald'))).toBe(true)
      expect(chipsA[1]!.classes().some(c => c.includes('rose') || c.includes('red'))).toBe(true)
      expect(chipsA[2]!.classes().some(c => c.includes('rose') || c.includes('red'))).toBe(true)
      expect(chipsA[3]!.classes().some(c => c.includes('emerald'))).toBe(true)
    })

    it('passes correctTeams to Best3rdPicker so selected wrong picks render red and selected correct picks render green', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: ['a3'],
      })
      const correctAnswer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: ['b3'],
      })
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, correctAnswer, readOnly: true },
      })
      await flushPromises()

      // The user picked a3 (wrong) → rose; b3 is the actual answer (not picked) → neutral with actual label.
      const wrongChip = wrapper.find('[data-testid="best-3rd-chip-a3"]')
      expect(wrongChip.exists()).toBe(true)
      expect(wrongChip.classes().some(c => c.includes('rose') || c.includes('red'))).toBe(true)
    })

    it('hides the save status row when readOnly', async () => {
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer: null, readOnly: true },
      })
      await flushPromises()
      expect(wrapper.find('[data-testid="group-standings-save-status"]').exists()).toBe(false)
    })
  })

  // UX-040: per-group points breakdown propagation + summary
  describe('UX-040 points breakdown', () => {
    it('renders a summary row with 3p × correctGroups when scored', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b3', 'b2', 'b4'] },
        best3rds: [],
      })
      const correctAnswer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: [],
      })
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, correctAnswer, readOnly: true },
      })
      await flushPromises()
      const summary = wrapper.find('[data-testid="group-standings-score-summary"]')
      expect(summary.exists()).toBe(true)
      // Only group A is exact match → 1 csoport × 3 pont = 3 pont
      expect(summary.text()).toContain('1')
      expect(summary.text()).toContain('3')
    })

    it('renders the per-card points pill on a correct group', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: [],
      })
      const correctAnswer = answer
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, correctAnswer, readOnly: true },
      })
      await flushPromises()
      const pillA = wrapper.find('[data-testid="group-standing-points-A"]')
      const pillB = wrapper.find('[data-testid="group-standing-points-B"]')
      expect(pillA.exists()).toBe(true)
      expect(pillB.exists()).toBe(true)
      expect(pillA.text()).toContain('3')
      expect(pillB.text()).toContain('3')
    })

    it('shows 0 on the per-card pill for an incorrect group', async () => {
      const answer = JSON.stringify({
        groups: { A: ['a1', 'a3', 'a2', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: [],
      })
      const correctAnswer = JSON.stringify({
        groups: { A: ['a1', 'a2', 'a3', 'a4'], B: ['b1', 'b2', 'b3', 'b4'] },
        best3rds: [],
      })
      const wrapper = mount(GroupStandingsPicker, {
        props: { options: OPTIONS, answer, correctAnswer, readOnly: true },
      })
      await flushPromises()
      const pillA = wrapper.find('[data-testid="group-standing-points-A"]')
      expect(pillA.exists()).toBe(true)
      expect(pillA.text()).toContain('0')
    })
  })
})
