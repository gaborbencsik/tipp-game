import { test, expect } from '@playwright/test'
import type { APIRequestContext, APIResponse } from '@playwright/test'

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

// We fire two consecutive requests until we get back the same ETag — that way
// we're sure the backend body is stable at that moment. Concurrent test writes
// (new league / team / player) from other workers can legitimately shift the
// ETag; the test invariant "same body → 304" only makes sense in a stable
// snapshot.
async function stableEtag(
  request: APIRequestContext,
  path: string,
): Promise<{ etag: string; firstResponse: APIResponse }> {
  const ATTEMPTS = 5
  for (let i = 0; i < ATTEMPTS; i++) {
    const first = await request.get(`${API_BASE}${path}`, { headers: AUTH_HEADERS })
    expect(first.status()).toBe(200)
    const etag = first.headers()['etag']
    expect(etag, `ETag missing on ${path}`).toBeDefined()
    const second = await request.get(`${API_BASE}${path}`, { headers: AUTH_HEADERS })
    expect(second.status()).toBe(200)
    if (second.headers()['etag'] === etag) return { etag: etag!, firstResponse: first }
  }
  throw new Error(`ETag did not stabilize for ${path} within ${ATTEMPTS} attempts`)
}

test.describe.configure({ mode: 'serial' })

test.describe('HTTP cache headers (OPS-005)', () => {
  for (const endpoint of CACHED_ENDPOINTS) {
    test(`${endpoint.path} → Cache-Control + ETag + 304 + stale-200`, async ({ request }) => {
      // 1) GET → 200 with Cache-Control + ETag (stabilized over consecutive calls)
      const { etag, firstResponse } = await stableEtag(request, endpoint.path)

      const cacheControl = firstResponse.headers()['cache-control']
      expect(cacheControl, 'Cache-Control header missing').toBeDefined()
      expect(cacheControl).toContain('private')
      expect(cacheControl).toContain(`max-age=${endpoint.maxAge}`)
      expect(cacheControl).toContain(`stale-while-revalidate=${endpoint.swr}`)
      expect(etag).toMatch(/^W\/"[a-f0-9]+"$/)

      // 2) Matching If-None-Match → 304 Not Modified, same ETag echoed back
      const cached = await request.get(`${API_BASE}${endpoint.path}`, {
        headers: { ...AUTH_HEADERS, 'If-None-Match': etag },
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
