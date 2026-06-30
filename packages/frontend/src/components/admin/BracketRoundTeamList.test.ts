import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BracketRoundTeamList from './BracketRoundTeamList.vue'
import type {
  BracketProgressionCorrectAnswer,
  BracketProgressionOptions,
  Team,
} from '@/types/index'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) } },
}))

// Make 32 teams + name lookup; tests use a synthetic bracket template so we control which
// teams belong to which round directly via correctAnswer.
const TEAMS: Team[] = Array.from({ length: 40 }, (_, i) => ({
  id: `team-${String(i).padStart(2, '0')}`,
  name: `Team ${i}`,
  // Minimal Team shape — only id + name are read by the component.
} as Team))

const TEAM_NAMES = new Map<string, string>(TEAMS.map(t => [t.id, t.name]))

const teamsListMock = vi.fn()
vi.mock('@/api/index', () => ({
  api: { teams: { list: (...args: unknown[]) => teamsListMock(...args) } },
}))

// A near-empty template — the new component reads participants directly from currentAnswer,
// not from a derivedBracket, so the template is mostly a structural placeholder.
const TEMPLATE_OPTIONS: BracketProgressionOptions = {
  bracketTemplate: { matches: [] },
}

const ALL32 = TEAMS.slice(0, 32).map(t => t.id)
const FIRST16 = ALL32.slice(0, 16)
const FIRST8 = FIRST16.slice(0, 8)
const FIRST4 = FIRST8.slice(0, 4)
const FIRST2 = FIRST4.slice(0, 2)

const FULL_ANSWER: BracketProgressionCorrectAnswer = {
  participants: {
    last_32: ALL32,
    last_16: FIRST16,
    qf: FIRST8,
    sf: FIRST4,
    final: FIRST2,
  },
  champion: FIRST2[0],
  bronzeWinner: FIRST4[2],
}

beforeEach(() => {
  teamsListMock.mockReset()
  teamsListMock.mockResolvedValue(TEAMS)
  setActivePinia(createPinia())
})

const baseProps = {
  options: TEMPLATE_OPTIONS,
  allTeams: TEAMS,
  currentCorrectAnswer: null as BracketProgressionCorrectAnswer | null,
  busy: false,
  teamNameById: TEAM_NAMES,
}

describe('BracketRoundTeamList v2 — rendering', () => {
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

describe('BracketRoundTeamList v2 — last_32 selection', () => {
  it('shows all teams as the last_32 pool (empty starting point)', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-last_32"] [data-testid^="team-chip-"]')
    expect(chips.length).toBe(TEAMS.length)
  })

  it('emits save with the new correctAnswer shape', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    // Pick exactly 32 chips
    for (const teamId of ALL32) {
      await wrapper.find(`[data-testid="round-section-last_32"] [data-team-id="${teamId}"]`).trigger('click')
    }
    await wrapper.find('[data-testid="save-last_32"]').trigger('click')
    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeTruthy()
    const [round, answer] = saveEvents![0] as [string, BracketProgressionCorrectAnswer]
    expect(round).toBe('last_32')
    expect([...answer.participants.last_32].sort()).toEqual([...ALL32].sort())
  })

  it('disables save until exactly 32 teams are selected', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    // Select 31 — save should still be disabled
    for (const teamId of ALL32.slice(0, 31)) {
      await wrapper.find(`[data-testid="round-section-last_32"] [data-team-id="${teamId}"]`).trigger('click')
    }
    const save = wrapper.find('[data-testid="save-last_32"]')
    expect(save.attributes('disabled')).toBeDefined()
  })
})

describe('BracketRoundTeamList v2 — cascade pool', () => {
  it('locks last_16 until last_32 is saved (i.e. has 32 teams in currentCorrectAnswer)', async () => {
    const wrapper = mount(BracketRoundTeamList, { props: baseProps })
    await flushPromises()
    const last16 = wrapper.find('[data-testid="round-section-last_16"]')
    expect(last16.attributes('data-locked')).toBe('true')
  })

  it('last_16 pool == last_32 selection from currentCorrectAnswer', async () => {
    const partial: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: [], qf: [], sf: [], final: [] },
      champion: null, bronzeWinner: null,
    }
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentCorrectAnswer: partial },
    })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-last_16"] [data-testid^="team-chip-"]')
    expect(chips.length).toBe(32)
  })

  it('qf pool == last_16 selection', async () => {
    const partial: BracketProgressionCorrectAnswer = {
      participants: { last_32: ALL32, last_16: FIRST16, qf: [], sf: [], final: [] },
      champion: null, bronzeWinner: null,
    }
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentCorrectAnswer: partial },
    })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-qf"] [data-testid^="team-chip-"]')
    expect(chips.length).toBe(16)
  })
})

describe('BracketRoundTeamList v2 — champion + bronze', () => {
  it('champion pool == final 2 teams; admin picks exactly 1', async () => {
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentCorrectAnswer: FULL_ANSWER },
    })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-champion"] [data-testid^="team-chip-"]')
    expect(chips.length).toBe(2)
  })

  it('bronze pool == sf minus final (read-only auto-derive)', async () => {
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentCorrectAnswer: FULL_ANSWER },
    })
    await flushPromises()
    const chips = wrapper.findAll('[data-testid="round-section-bronze"] [data-testid^="team-chip-"]')
    const ids = chips.map(c => c.attributes('data-team-id')).sort()
    // sf - final = FIRST4[2..3]
    expect(ids).toEqual([FIRST4[2], FIRST4[3]].sort())
  })

  it('save-champion emits an updated correctAnswer with new champion', async () => {
    const wrapper = mount(BracketRoundTeamList, {
      props: { ...baseProps, currentCorrectAnswer: FULL_ANSWER },
    })
    await flushPromises()
    await wrapper.find(`[data-testid="round-section-champion"] [data-team-id="${FIRST2[1]}"]`).trigger('click')
    // The previously-selected champion chip should deselect automatically (single-pick round).
    await wrapper.find('[data-testid="save-champion"]').trigger('click')
    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeTruthy()
    const [round, answer] = saveEvents![0] as [string, BracketProgressionCorrectAnswer]
    expect(round).toBe('champion')
    expect(answer.champion).toBe(FIRST2[1])
  })
})
