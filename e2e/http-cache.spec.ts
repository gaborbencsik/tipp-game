import { test, expect } from '@playwright/test'

const API_BASE = process.env['API_URL'] ?? 'http://localhost:3000'
const AUTH_HEADERS = { Authorization: 'Bearer dev-bypass-token' }

interface CachedEndpoint {
  readonly path: string
  readonly maxAge: number
  readonly swr: number
}

const CACHED_ENDPOINTS: ReadonlyArray<CachedEndpoint> = [
  { path: '/api/teams', maxAge: 1800, swr: 3600 },
  { path: '/api/players', maxAge: 1800, swr: 3600 },
  { path: '/api/leagues', maxAge: 3600, swr: 7200 },
  { path: '/api/scoring-config/default', maxAge: 600, swr: 1200 },
  { path: '/api/scoring/explainer', maxAge: 600, swr: 1200 },
  { path: '/api/stat-prediction-templates', maxAge: 600, swr: 1200 },
  // OPS-006: revalidate-only (max-age=0 + ETag) on dynamic lists
  { path: '/api/leaderboard', maxAge: 0, swr: 30 },
  { path: '/api/matches', maxAge: 0, swr: 15 },
]

test.describe('HTTP cache headers (OPS-005)', () => {
  for (const endpoint of CACHED_ENDPOINTS) {
    test(`${endpoint.path} → Cache-Control + ETag + 304 + stale-200`, async ({ request }) => {
      // 1) Initial GET → 200 with Cache-Control + ETag
      const first = await request.get(`${API_BASE}${endpoint.path}`, { headers: AUTH_HEADERS })
      expect(first.status()).toBe(200)

      const cacheControl = first.headers()['cache-control']
      expect(cacheControl, 'Cache-Control header missing').toBeDefined()
      expect(cacheControl).toContain('private')
      expect(cacheControl).toContain(`max-age=${endpoint.maxAge}`)
      expect(cacheControl).toContain(`stale-while-revalidate=${endpoint.swr}`)

      const etag = first.headers()['etag']
      expect(etag, 'ETag header missing').toBeDefined()
      expect(etag).toMatch(/^W\/"[a-f0-9]+"$/)

      // 2) Matching If-None-Match → 304 Not Modified, same ETag echoed back
      const cached = await request.get(`${API_BASE}${endpoint.path}`, {
        headers: { ...AUTH_HEADERS, 'If-None-Match': etag! },
      })
      expect(cached.status()).toBe(304)
      expect(cached.headers()['etag']).toBe(etag)

      // 3) Stale If-None-Match → 200 with a fresh ETag (not the stale one)
      const stale = await request.get(`${API_BASE}${endpoint.path}`, {
        headers: { ...AUTH_HEADERS, 'If-None-Match': 'W/"deadbeefcafe0000"' },
      })
      expect(stale.status()).toBe(200)
      expect(stale.headers()['etag']).not.toBe('W/"deadbeefcafe0000"')
    })
  }
})
