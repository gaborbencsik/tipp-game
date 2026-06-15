import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))

import { syncPlayers } from '../src/services/player-sync.service.js'
import type { FootballApiClient } from '../src/services/football-api.service.js'
import type { ApiFootballSquadPlayer, ApiFootballPlayerEntry } from '../src/types/index.js'

interface CapturedInsert {
  readonly name: string
  readonly shortName?: string | null
  readonly externalId: number
}

interface CapturedUpdate {
  readonly name?: string
  readonly shortName?: string | null
}

function makeSquadPlayer(overrides: Partial<ApiFootballSquadPlayer> = {}): ApiFootballSquadPlayer {
  return {
    id: 100,
    name: 'Rodrygo',
    age: 24,
    number: 11,
    position: 'Attacker',
    photo: null,
    ...overrides,
  }
}

function makeStatsEntry(overrides: { name?: string; firstname?: string; lastname?: string; id?: number } = {}): ApiFootballPlayerEntry {
  return {
    player: {
      id: overrides.id ?? 100,
      name: overrides.name ?? 'Rodrygo',
      firstname: overrides.firstname ?? 'Rodrygo',
      lastname: overrides.lastname ?? 'Silva de Goes',
      age: 24,
      photo: null,
    },
    statistics: [],
  }
}

function makeClient(opts: {
  squad?: readonly ApiFootballSquadPlayer[]
  playersEntries?: readonly ApiFootballPlayerEntry[]
}): FootballApiClient {
  return {
    fetchSquad: vi.fn().mockResolvedValue({
      paging: { current: 1, total: 1 },
      response: opts.squad
        ? [{ team: { id: 1, name: 'Brazil', logo: '' }, players: opts.squad }]
        : [],
    }),
    fetchPlayers: vi.fn().mockResolvedValue({
      paging: { current: 1, total: 1 },
      response: opts.playersEntries ?? [],
    }),
  } as unknown as FootballApiClient
}

describe('player-sync.service – short_name', () => {
  let capturedInserts: CapturedInsert[]
  let capturedUpdates: { id: string; set: CapturedUpdate }[]

  beforeEach(() => {
    vi.clearAllMocks()
    capturedInserts = []
    capturedUpdates = []

    // National teams query
    const teamsQuery = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'team-uuid-1', externalId: 6 },
        ]),
      }),
    }
    mockDb.select.mockImplementation(() => teamsQuery)

    // Insert capture
    mockDb.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((row: CapturedInsert) => {
        capturedInserts.push(row)
        return Promise.resolve(undefined)
      }),
    }))

    // Update capture: update().set(...).where(...)
    mockDb.update.mockImplementation(() => ({
      set: vi.fn().mockImplementation((row: CapturedUpdate) => ({
        where: vi.fn().mockImplementation(() => {
          capturedUpdates.push({ id: 'existing-id', set: row })
          return Promise.resolve(undefined)
        }),
      })),
    }))
  })

  it('squad insert path: writes short_name = player.name', async () => {
    // Players lookup: nothing exists, all inserts. Override select to return [] for player lookup
    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) {
        // teams query
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'team-uuid-1', externalId: 6 }]) }) }
      }
      // player lookup: not found
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }
    })

    const client = makeClient({
      squad: [makeSquadPlayer({ id: 100, name: 'Rodrygo' })],
      playersEntries: [],
    })

    await syncPlayers(client)

    const insert = capturedInserts.find((r) => r.externalId === 100)
    expect(insert).toBeDefined()
    expect(insert!.name).toBe('Rodrygo')
    expect(insert!.shortName).toBe('Rodrygo')
  })

  it('players (stats) update path: short_name from player.name; long name preserved in name', async () => {
    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'team-uuid-1', externalId: 6 }]) }) }
      }
      // squad path: return existing player to skip insert
      if (selectCall === 2) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]) }) }) }
      }
      // updatePlayerName lookup: existing
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]) }) }) }
    })

    const client = makeClient({
      squad: [makeSquadPlayer({ id: 100, name: 'Rodrygo' })],
      playersEntries: [
        makeStatsEntry({ id: 100, name: 'Rodrygo', firstname: 'Rodrygo', lastname: 'Silva de Goes' }),
      ],
    })

    await syncPlayers(client)

    // Find the update from updatePlayerName (it uses both name + shortName)
    const nameUpdate = capturedUpdates.find((u) => u.set.name === 'Rodrygo Silva de Goes')
    expect(nameUpdate).toBeDefined()
    expect(nameUpdate!.set.shortName).toBe('Rodrygo')
  })

  it('players update with empty player.name does not overwrite short_name with null', async () => {
    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'team-uuid-1', externalId: 6 }]) }) }
      }
      if (selectCall === 2) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]) }) }) }
      }
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]) }) }) }
    })

    const client = makeClient({
      squad: [makeSquadPlayer({ id: 100, name: 'Rodrygo' })],
      playersEntries: [
        makeStatsEntry({ id: 100, name: '', firstname: 'Rodrygo', lastname: 'Silva de Goes' }),
      ],
    })

    await syncPlayers(client)

    // Find the update from updatePlayerName
    const nameUpdate = capturedUpdates.find((u) => u.set.name === 'Rodrygo Silva de Goes')
    expect(nameUpdate).toBeDefined()
    // shortName must NOT be set (so we do not overwrite an existing value with null)
    expect(nameUpdate!.set.shortName).toBeUndefined()
  })

  it('squad update path: writes short_name = player.name on existing rows', async () => {
    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'team-uuid-1', externalId: 6 }]) }) }
      }
      // squad lookup: existing → update path
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]) }) }) }
    })

    const client = makeClient({
      squad: [makeSquadPlayer({ id: 100, name: 'Vinícius Júnior' })],
      playersEntries: [],
    })

    await syncPlayers(client)

    const squadUpdate = capturedUpdates.find((u) => u.set.shortName === 'Vinícius Júnior')
    expect(squadUpdate).toBeDefined()
  })

  it('squad update path: empty player.name does not overwrite short_name with null', async () => {
    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      selectCall++
      if (selectCall === 1) {
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'team-uuid-1', externalId: 6 }]) }) }
      }
      return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-id' }]) }) }) }
    })

    const client = makeClient({
      squad: [makeSquadPlayer({ id: 100, name: '' })],
      playersEntries: [],
    })

    await syncPlayers(client)

    expect(capturedUpdates.length).toBeGreaterThan(0)
    const anyShortName = capturedUpdates.find((u) => u.set.shortName !== undefined)
    expect(anyShortName).toBeUndefined()
  })
})
