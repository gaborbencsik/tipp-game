import { describe, it, expect } from 'vitest'
import { parseBrowserName } from '../src/services/user-agent.service.js'

describe('parseBrowserName', () => {
  it('returns "Unknown browser" for null', () => {
    expect(parseBrowserName(null)).toBe('Unknown browser')
  })

  it('returns "Unknown browser" for undefined', () => {
    expect(parseBrowserName(undefined)).toBe('Unknown browser')
  })

  it('returns "Unknown browser" for empty string', () => {
    expect(parseBrowserName('')).toBe('Unknown browser')
    expect(parseBrowserName('   ')).toBe('Unknown browser')
  })

  it('returns "Unknown browser" for unrecognised UA', () => {
    expect(parseBrowserName('totally-not-a-browser-string')).toBe('Unknown browser')
  })

  it('parses Chrome on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(parseBrowserName(ua)).toMatch(/Chrome.*macOS/)
  })

  it('parses Safari on iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(parseBrowserName(ua)).toMatch(/Safari.*iOS/)
  })

  it('parses Firefox on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    expect(parseBrowserName(ua)).toMatch(/Firefox.*Windows/)
  })

  it('parses Edge on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(parseBrowserName(ua)).toMatch(/Edge.*Windows/)
  })
})
