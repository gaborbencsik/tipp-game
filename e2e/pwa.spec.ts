import { test, expect } from '@playwright/test'

test.describe('PWA shell', () => {
  test('manifest is served as valid JSON with PWA fields', async ({ request, baseURL }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.name).toBe('VB Tippjáték')
    expect(body.short_name).toBe('Tipp game')
    expect(body.start_url).toBe('/')
    expect(body.display).toBe('standalone')
    expect(body.theme_color).toBe('#3b82f6')
    expect(body.background_color).toBe('#ffffff')
    expect(Array.isArray(body.icons)).toBe(true)
    expect(body.icons.length).toBeGreaterThanOrEqual(5)

    const sizes: string[] = body.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '180x180']))

    const purposes: string[] = body.icons.map((i: { purpose: string }) => i.purpose)
    expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']))
    expect(baseURL).toBeTruthy()
  })

  test('index.html has PWA meta tags', async ({ request }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)

    const html = await res.text()
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('href="/manifest.webmanifest"')
    expect(html).toContain('name="theme-color"')
    expect(html).toContain('content="#3b82f6"')
    expect(html).toContain('rel="apple-touch-icon"')
    expect(html).toContain('name="apple-mobile-web-app-capable"')
    expect(html).toContain('name="apple-mobile-web-app-title"')
  })

  test('apple-touch-icon is reachable', async ({ request }) => {
    const res = await request.get('/icons/apple-touch-icon-180.png')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('image/png')
  })

  test('PWA icons are reachable', async ({ request }) => {
    for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png']) {
      const res = await request.get(path)
      expect(res.status(), `expected 200 for ${path}`).toBe(200)
    }
  })

  test('offline.html fallback page is reachable', async ({ request }) => {
    const res = await request.get('/offline.html')
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toContain('Nincs internetkapcsolat')
  })
})
