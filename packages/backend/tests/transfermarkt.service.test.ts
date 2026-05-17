import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('parseMarketValue', () => {
  it('parses millions correctly', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('773.50 M EUR')).toBe(773_500_000)
  })

  it('parses integer millions', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('100 M EUR')).toBe(100_000_000)
  })

  it('parses thousands', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('500 K EUR')).toBe(500_000)
  })

  it('parses billions', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('1.20 B EUR')).toBe(1_200_000_000)
  })

  it('rounds fractional results to integer', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('1.234 M EUR')).toBe(1_234_000)
  })

  it('handles comma as decimal separator', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('773,50 M EUR')).toBe(773_500_000)
  })

  it('returns null for null input', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue(null)).toBeNull()
  })

  it('returns null for undefined input', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue(undefined)).toBeNull()
  })

  it('returns null for empty string', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('')).toBeNull()
  })

  it('returns null for unparseable string', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('N/A')).toBeNull()
  })

  it('returns null for missing unit', async () => {
    const { parseMarketValue } = await import('../src/services/transfermarkt.service.js')
    expect(parseMarketValue('500 EUR')).toBeNull()
  })
})

describe('syncTransfermarktValues', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates teams with valid market values', async () => {
    const mockWhere = vi.fn().mockResolvedValue([
      { id: 'uuid-1', transfermarktId: 3262 },
      { id: 'uuid-2', transfermarktId: 3468 },
    ])
    const mockSetWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.doMock('../src/db/client.js', () => ({
      db: { select: mockSelect, update: mockUpdate },
    }))

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { squadDetails: { currentMarketValue: { value: 773_500_000 } } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { squadDetails: { currentMarketValue: { value: 120_000_000 } } } }),
      })

    const { syncTransfermarktValues } = await import('../src/services/transfermarkt.service.js')
    const result = await syncTransfermarktValues()

    expect(result.updated).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })

  it('skips teams when fetch fails', async () => {
    const mockWhere = vi.fn().mockResolvedValue([
      { id: 'uuid-1', transfermarktId: 3262 },
      { id: 'uuid-2', transfermarktId: 3468 },
    ])
    const mockSetWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.doMock('../src/db/client.js', () => ({
      db: { select: mockSelect, update: mockUpdate },
    }))

    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { squadDetails: { currentMarketValue: { value: 120_000_000 } } } }),
      })

    const { syncTransfermarktValues } = await import('../src/services/transfermarkt.service.js')
    const result = await syncTransfermarktValues()

    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
  })

  it('skips teams when market value is unparseable', async () => {
    const mockWhere = vi.fn().mockResolvedValue([
      { id: 'uuid-1', transfermarktId: 3262 },
    ])
    const mockSetWhere = vi.fn().mockResolvedValue(undefined)
    const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.doMock('../src/db/client.js', () => ({
      db: { select: mockSelect, update: mockUpdate },
    }))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { squadDetails: { currentMarketValue: { value: null } } } }),
    })

    const { syncTransfermarktValues } = await import('../src/services/transfermarkt.service.js')
    const result = await syncTransfermarktValues()

    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('returns empty result when no teams have transfermarktId', async () => {
    const mockWhere = vi.fn().mockResolvedValue([])
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    vi.doMock('../src/db/client.js', () => ({
      db: { select: mockSelect, update: vi.fn() },
    }))

    const { syncTransfermarktValues } = await import('../src/services/transfermarkt.service.js')
    const result = await syncTransfermarktValues()

    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})
