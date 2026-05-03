import type { ApiFootballFixture, ApiFootballTeam, ApiFootballResponse } from '../types/index.js'

export interface FootballApiConfig {
  readonly apiKey: string
  readonly baseUrl: string
  readonly timeoutMs: number
  readonly retryDelayMs?: number
}

export interface FixtureParams {
  readonly league: number
  readonly season: number
  readonly status?: string
}

export interface TeamParams {
  readonly league: number
  readonly season: number
}

export interface FootballApiClient {
  fetchFixtures(params: FixtureParams): Promise<ApiFootballResponse<ApiFootballFixture>>
  fetchTeams(params: TeamParams): Promise<ApiFootballResponse<ApiFootballTeam>>
}

export class FootballApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'FootballApiError'
  }
}

export class FootballApiRateLimitError extends FootballApiError {
  constructor() {
    super(429, 'Rate limit exceeded after max retries')
    this.name = 'FootballApiRateLimitError'
  }
}

export class FootballApiTimeoutError extends FootballApiError {
  constructor() {
    super(0, 'Request timed out')
    this.name = 'FootballApiTimeoutError'
  }
}

const MAX_RETRIES = 3
const INITIAL_DELAY_MS = 1000

export function buildConfig(): FootballApiConfig {
  const apiKey = process.env['FOOTBALL_API_KEY']
  if (!apiKey) throw new Error('FOOTBALL_API_KEY environment variable is required')

  return {
    apiKey,
    baseUrl: process.env['FOOTBALL_API_BASE_URL'] ?? 'https://v3.football.api-sports.io',
    timeoutMs: 10_000,
  }
}

export function createFootballApiClient(config: FootballApiConfig): FootballApiClient {
  async function fetchWithRetry<T>(url: URL): Promise<T> {
    let delay = config.retryDelayMs ?? INITIAL_DELAY_MS

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

      let response: Response
      try {
        response = await fetch(url, {
          headers: { 'x-apisports-key': config.apiKey },
          signal: controller.signal,
        })
      } catch (err) {
        clearTimeout(timeout)
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new FootballApiTimeoutError()
        }
        throw err
      } finally {
        clearTimeout(timeout)
      }

      if (response.status === 429) {
        if (attempt === MAX_RETRIES) throw new FootballApiRateLimitError()
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2
        continue
      }

      if (!response.ok) {
        throw new FootballApiError(response.status, `API returned ${response.status}`)
      }

      return await response.json() as T
    }

    throw new FootballApiRateLimitError()
  }

  return {
    async fetchFixtures(params: FixtureParams): Promise<ApiFootballResponse<ApiFootballFixture>> {
      const url = new URL(`${config.baseUrl}/fixtures`)
      url.searchParams.set('league', String(params.league))
      url.searchParams.set('season', String(params.season))
      if (params.status) url.searchParams.set('status', params.status)
      return fetchWithRetry(url)
    },

    async fetchTeams(params: TeamParams): Promise<ApiFootballResponse<ApiFootballTeam>> {
      const url = new URL(`${config.baseUrl}/teams`)
      url.searchParams.set('league', String(params.league))
      url.searchParams.set('season', String(params.season))
      return fetchWithRetry(url)
    },
  }
}
