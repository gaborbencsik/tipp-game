import { describe, it, expect } from 'vitest'
import { extractInviteCodeFromRedirect } from './inviteRedirect.js'

describe('extractInviteCodeFromRedirect', () => {
  it('returns the code from /app/join/CODE', () => {
    expect(extractInviteCodeFromRedirect('/app/join/ABC123')).toBe('ABC123')
  })

  it('accepts mixed case and digits', () => {
    expect(extractInviteCodeFromRedirect('/app/join/aB12cD')).toBe('aB12cD')
  })

  it('returns null for non-join paths', () => {
    expect(extractInviteCodeFromRedirect('/app/home')).toBeNull()
    expect(extractInviteCodeFromRedirect('/app/groups')).toBeNull()
  })

  it('returns null when path has trailing segments', () => {
    expect(extractInviteCodeFromRedirect('/app/join/ABC/extra')).toBeNull()
  })

  it('returns null for empty code', () => {
    expect(extractInviteCodeFromRedirect('/app/join/')).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(extractInviteCodeFromRedirect(undefined)).toBeNull()
    expect(extractInviteCodeFromRedirect(null)).toBeNull()
    expect(extractInviteCodeFromRedirect(['/app/join/X'])).toBeNull()
    expect(extractInviteCodeFromRedirect(123)).toBeNull()
  })
})
