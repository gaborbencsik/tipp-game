import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BracketRoundTeamList from './BracketRoundTeamList.vue'
import type { BracketProgressionCorrectAnswer } from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) } },
}))

const teamsListMock = vi.fn()
vi.mock('@/api/index', () => ({
  api: { teams: { list: (...args: unknown[]) => teamsListMock(...args) } },
}))

// 32 teams pool so the last_32 chip section actually has the full universe.
function makeTeams(n: number): { id: string; name: string }[] {
  return Array.from({ length: n }, (_, i) => ({ id: `team_${i + 1}`, name: `Team ${String(i + 1).padStart(2, '0')}` }))
}

const ALL_TEAMS = makeTeams(32)

const TEAM_NAMES = new Map<string, string>(ALL_TEAMS.map(t => [t.id, t.name]))

beforeEach(() => {
  teamsListMock.mockReset()
  teamsListMock.mockResolvedValue(ALL_TEAMS)
  setActivePinia(createPinia())
})

const baseProps = {
  currentAnswerJson: null as string | null,
  busy: false,
  teamNameById: TEAM_NAMES,
}

describe('BracketRoundTeamList — rendering', () => {
  it('renders a section for each of the 7 admin rounds', async () => {
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
      'round-section-champion',
      'round-section-bronze',
    ])
  })
})

describe('BracketRoundTeamList — last_32 selection', () => {
  it('lists all teams from /api/teams as last_32 chips', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-last_32"] [data-testid^="team-chip-"]')
    expect(chips).toHaveLength(32)
  })

  it('toggles selection state on chip click', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const chip = wrapper.find('[data-testid="round-section-last_32"] [data-team-id="team_1"]')
    expect(chip.attributes('data-selected')).toBe('false')
    await chip.trigger('click')
    expect(chip.attributes('data-selected')).toBe('true')
    await chip.trigger('click')
    expect(chip.attributes('data-selected')).toBe('false')
  })

  it('emits save with a participants-shape correct answer when 32 teams are picked', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    // Pick the first 32 teams (the only 32 in the test pool).
    for (const t of ALL_TEAMS) {
      await wrapper.find(`[data-testid="round-section-last_32"] [data-team-id="${t.id}"]`).trigger('click')
    }
    await wrapper.find('[data-testid="save-last_32"]').trigger('click')

    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeTruthy()
    expect(saveEvents!.length).toBe(1)
    const [round, answer] = saveEvents![0] as [string, BracketProgressionCorrectAnswer]
    expect(round).toBe('last_32')
    expect(answer.participants.last_32).toHaveLength(32)
    expect(answer.participants.last_16).toEqual([])
    expect(answer.champion).toBeNull()
  })
})

describe('BracketRoundTeamList — cascade gating', () => {
  it('disables last_16 until last_32 is set', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    expect(wrapper.find('[data-testid="round-section-last_16"]').attributes('data-locked')).toBe('true')
  })

  it('enables last_16 once last_32 participants are present and shows them as chips', async () => {
    const seeded: BracketProgressionCorrectAnswer = {
      participants: {
        last_32: ALL_TEAMS.map(t => t.id),
        last_16: [],
        qf: [],
        sf: [],
        final: [],
      },
      champion: null,
      bronzeWinner: null,
    }
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentAnswerJson: JSON.stringify(seeded) },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="round-section-last_16"]').attributes('data-locked')).toBe('false')
    const chips = wrapper.findAll('[data-testid="round-section-last_16"] [data-testid^="team-chip-"]')
    expect(chips).toHaveLength(32)
  })
})

describe('BracketRoundTeamList — champion & bronze', () => {
  // Build a seeded state where final is filled with two teams — champion chips = the 2
  // finalists, bronze chips = the other 2 SF teams.
  const seeded: BracketProgressionCorrectAnswer = {
    participants: {
      last_32: ALL_TEAMS.map(t => t.id),
      last_16: ALL_TEAMS.slice(0, 16).map(t => t.id),
      qf: ALL_TEAMS.slice(0, 8).map(t => t.id),
      sf: ALL_TEAMS.slice(0, 4).map(t => t.id),
      final: ALL_TEAMS.slice(0, 2).map(t => t.id),
    },
    champion: null,
    bronzeWinner: null,
  }

  it('shows the two finalists as the champion pool', async () => {
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentAnswerJson: JSON.stringify(seeded) },
    })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-champion"] [data-testid^="team-chip-"]')
    const ids = chips.map(c => c.attributes('data-team-id')).sort()
    expect(ids).toEqual(['team_1', 'team_2'])
  })

  it('shows the two SF losers (sf \\ final) as the bronze pool', async () => {
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentAnswerJson: JSON.stringify(seeded) },
    })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-bronze"] [data-testid^="team-chip-"]')
    const ids = chips.map(c => c.attributes('data-team-id')).sort()
    expect(ids).toEqual(['team_3', 'team_4'])
  })
})
