export function extractInviteCodeFromRedirect(redirect: unknown): string | null {
  if (typeof redirect !== 'string') return null
  const match = redirect.match(/^\/app\/join\/([A-Za-z0-9]+)$/)
  return match ? match[1] ?? null : null
}
