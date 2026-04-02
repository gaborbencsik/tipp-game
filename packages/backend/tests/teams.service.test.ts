import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Team } from '../src/types/index.js'

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockOrderBy,
  mockInsert,
  mockValues,
  mockReturning,
  mockUpdate,
  mockSet,
  mockDelete,
} = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([])
  const mockSet = vi.fn()
  const mockValues = vi.fn()
  const mockWhere = vi.fn()
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()

  return {
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
    mockInsert,
    mockValues,
    mockReturning,
    mockUpdate,
    mockSet,
    mockDelete,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}))

import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../src/services/teams.service.js'

const TEAM_ROW = {
  id: 'team-uuid-1',
  name: 'Germany',
  shortCode: 'GER',
  flagUrl: 'https://example.com/ger.png',
  group: 'A',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEAM_API: Team = {
  id: 'team-uuid-1',
  name: 'Germany',
  shortCode: 'GER',
  flagUrl: 'https://example.com/ger.png',
  group: 'A',
}

function setupSelectChain(rows: unknown[]) {
  mockOrderBy.mockResolvedValue(rows)
  mockWhere.mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) })
  mockFrom.mockReturnValue({ orderBy: mockOrderBy, where: mockWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

describe('getTeams', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupSelectChain([])
  })

  it('empty DB → returns []', async () => {
    mockOrderBy.mockResolvedValue([])
    mockFrom.mockReturnValue({ orderBy: mockOrderBy, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    const result = await getTeams()
    expect(result).toEqual([])
  })

  it('rows present → returns Team array', async () => {
    const row2 = { ...TEAM_ROW, id: 'team-uuid-2', name: 'France', shortCode: 'FRA' }
    mockOrderBy.mockResolvedValue([TEAM_ROW, row2])
    mockFrom.mockReturnValue({ orderBy: mockOrderBy, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    const result = await getTeams()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(TEAM_API)
    expect(result[1]).toMatchObject({ id: 'team-uuid-2', name: 'France' })
  })
})

describe('getTeamById', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('existing id → returns Team', async () => {
    const mockLimit = vi.fn().mockResolvedValue([TEAM_ROW])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    const result = await getTeamById('team-uuid-1')
    expect(result).toEqual(TEAM_API)
  })

  it('non-existing id → AppError 404', async () => {
    const mockLimit = vi.fn().mockResolvedValue([])
    mockWhere.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })

    await expect(getTeamById('nonexistent')).rejects.toMatchObject({
      status: 404,
      message: 'Team not found',
    })
  })
})

describe('createTeam', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('valid input → returns new Team', async () => {
    mockReturning.mockResolvedValue([TEAM_ROW])
    mockValues.mockReturnValue({ returning: mockReturning })
    mockInsert.mockReturnValue({ values: mockValues })

    const result = await createTeam({ name: 'Germany', shortCode: 'GER', flagUrl: 'https://example.com/ger.png', group: 'A' })
    expect(result).toEqual(TEAM_API)
  })
})

describe('updateTeam', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('existing id → returns updated Team', async () => {
    const updatedRow = { ...TEAM_ROW, name: 'Deutschland' }
    mockReturning.mockResolvedValue([updatedRow])
    mockWhere.mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere })
    mockUpdate.mockReturnValue({ set: mockSet })

    const result = await updateTeam('team-uuid-1', { name: 'Deutschland' })
    expect(result.name).toBe('Deutschland')
  })

  it('non-existing id → AppError 404', async () => {
    mockReturning.mockResolvedValue([])
    mockWhere.mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere })
    mockUpdate.mockReturnValue({ set: mockSet })

    await expect(updateTeam('nonexistent', { name: 'X' })).rejects.toMatchObject({
      status: 404,
      message: 'Team not found',
    })
  })
})

describe('deleteTeam', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('existing id → resolves without error', async () => {
    const mockWhereDelete = vi.fn().mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ where: mockWhereDelete })

    await expect(deleteTeam('team-uuid-1')).resolves.toBeUndefined()
  })

  it('FK violation (23503) → AppError 409', async () => {
    const fkError = Object.assign(new Error('FK violation'), { code: '23503' })
    const mockWhereDelete = vi.fn().mockRejectedValue(fkError)
    mockDelete.mockReturnValue({ where: mockWhereDelete })

    await expect(deleteTeam('team-uuid-1')).rejects.toMatchObject({
      status: 409,
      message: 'Team has associated matches',
    })
  })
})
