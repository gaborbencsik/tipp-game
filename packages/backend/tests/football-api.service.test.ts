import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFootballApiClient, buildConfig, FootballApiRateLimitError, FootballApiTimeoutError, FootballApiError } from '../src/services/football-api.service.js'

describe('football-api.service', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubEnv('FOOTBALL_API_KEY', 'test-key')
    vi.stubEnv('FOOTBALL_API_BASE_URL', 'https://v3.football.api-sports.io')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  describe('buildConfig', () => {
    it('reads config from env vars', () => {
      const config = buildConfig()
      expect(config.apiKey).toBe('test-key')
      expect(config.baseUrl).toBe('https://v3.football.api-sports.io')
    })

    it('throws if FOOTBALL_API_KEY is missing', () => {
      vi.stubEnv('FOOTBALL_API_KEY', '')
      expect(() => buildConfig()).toThrow('FOOTBALL_API_KEY')
    })
  })

  describe('fetchFixtures', () => {
    it('sends correct headers and params', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ results: 0, response: [] }), { status: 200 }))

      const client = createFootballApiClient({ apiKey: 'test-key', baseUrl: 'https://api.test', timeoutMs: 5000 })
      await client.fetchFixtures({ league: 1, season: 2026 })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, options] = mockFetch.mock.calls[0]
      expect(url.toString()).toContain('/fixtures?league=1&season=2026')
      expect(options.headers['x-apisports-key']).toBe('test-key')
    })

    it('returns parsed response', async () => {
      const payload = { results: 2, response: [{ fixture: { id: 1 } }, { fixture: { id: 2 } }] }
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))

      const client = createFootballApiClient({ apiKey: 'key', baseUrl: 'https://api.test', timeoutMs: 5000 })
      const result = await client.fetchFixtures({ league: 1, season: 2026 })

      expect(result.results).toBe(2)
      expect(result.response).toHaveLength(2)
    })
  })

  describe('fetchTeams', () => {
    it('sends correct params', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ results: 0, response: [] }), { status: 200 }))

      const client = createFootballApiClient({ apiKey: 'key', baseUrl: 'https://api.test', timeoutMs: 5000 })
      await client.fetchTeams({ league: 271, season: 2025 })

      const [url] = mockFetch.mock.calls[0]
      expect(url.toString()).toContain('/teams?league=271&season=2025')
    })
  })

  describe('error handling', () => {
    it('retries on 429 and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ results: 0, response: [] }), { status: 200 }))

      const client = createFootballApiClient({ apiKey: 'key', baseUrl: 'https://api.test', timeoutMs: 5000, retryDelayMs: 1 })
      const result = await client.fetchFixtures({ league: 1, season: 2026 })

      expect(result.results).toBe(0)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws FootballApiRateLimitError after max retries', async () => {
      mockFetch.mockResolvedValue(new Response('', { status: 429 }))

      const client = createFootballApiClient({ apiKey: 'key', baseUrl: 'https://api.test', timeoutMs: 5000, retryDelayMs: 1 })

      await expect(client.fetchFixtures({ league: 1, season: 2026 }))
        .rejects.toBeInstanceOf(FootballApiRateLimitError)
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('throws FootballApiError on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }))

      const client = createFootballApiClient({ apiKey: 'key', baseUrl: 'https://api.test', timeoutMs: 5000 })

      await expect(client.fetchFixtures({ league: 1, season: 2026 }))
        .rejects.toBeInstanceOf(FootballApiError)
    })

    it('throws FootballApiTimeoutError on abort', async () => {
      mockFetch.mockImplementationOnce(() => {
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      })

      const client = createFootballApiClient({ apiKey: 'key', baseUrl: 'https://api.test', timeoutMs: 1 })

      await expect(client.fetchFixtures({ league: 1, season: 2026 }))
        .rejects.toBeInstanceOf(FootballApiTimeoutError)
    })
  })
})
