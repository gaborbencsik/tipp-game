import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '@/api/index'

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('api.health() calls GET /api/health', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok', timestamp: '2026-03-28T00:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const result = await api.health()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
    )
    expect(result.status).toBe('ok')
  })

  it('api.health() returns the timestamp', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok', timestamp: '2026-03-28T12:00:00.000Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const result = await api.health()
    expect(result.timestamp).toBe('2026-03-28T12:00:00.000Z')
  })

  it('non-ok response → throws Error with error message', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await expect(api.health()).rejects.toThrow('Service unavailable')
  })

  it('non-JSON error response → uses statusText', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    )
    await expect(api.health()).rejects.toThrow('Internal Server Error')
  })

  it('404 response → throws Error', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await expect(api.health()).rejects.toThrow('Not Found')
  })
})
