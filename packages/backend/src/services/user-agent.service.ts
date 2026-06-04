import { UAParser } from 'ua-parser-js'

export function parseBrowserName(ua: string | null | undefined): string {
  if (!ua || ua.trim().length === 0) return 'Unknown browser'
  const parser = new UAParser(ua)
  const browserName = parser.getBrowser().name
  const osName = parser.getOS().name
  if (!browserName) return 'Unknown browser'
  return osName ? `${browserName} (${osName})` : browserName
}
