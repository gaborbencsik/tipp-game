import { eq, isNotNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { teams } from '../db/schema/index.js'
import type { TransfermarktSyncResult } from '../types/index.js'

const TIMEOUT_MS = 10_000
const BASE_URL = process.env.TRANSFERMARKT_BASE_URL ?? 'https://tmapi-alpha.transfermarkt.technology'

export class TransfermarktApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'TransfermarktApiError'
  }
}

export class TransfermarktApiTimeoutError extends Error {
  constructor() {
    super('Transfermarkt API request timed out')
    this.name = 'TransfermarktApiTimeoutError'
  }
}

export function parseMarketValue(raw: string | null | undefined): number | null {
  if (!raw) return null

  const normalized = raw.replace(',', '.')
  const match = normalized.match(/^([\d.]+)\s*(K|M|B)\s*EUR$/i)
  if (!match) return null

  const value = parseFloat(match[1])
  if (isNaN(value)) return null

  const multipliers: Record<string, number> = { K: 1_000, M: 1_000_000, B: 1_000_000_000 }
  const multiplier = multipliers[match[2].toUpperCase()]

  return Math.round(value * multiplier)
}

interface TransfermarktTeamRow {
  readonly id: string
  readonly transfermarktId: number
}

async function fetchClubValue(transfermarktId: number): Promise<number | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const url = `${BASE_URL}/club/${transfermarktId}`

  try {
    console.log(`[transfermarkt] GET ${url}`)
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      console.log(`[transfermarkt] ${url} → HTTP ${response.status}`)
      throw new TransfermarktApiError(response.status, `HTTP ${response.status}`)
    }

    const data: unknown = await response.json()
    const body = data as { data?: { squadDetails?: { currentMarketValue?: { value?: number } } } }
    const marketValue = body.data?.squadDetails?.currentMarketValue?.value ?? null
    console.log(`[transfermarkt] club/${transfermarktId} → currentMarketValue: ${marketValue}`)
    return marketValue
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.log(`[transfermarkt] club/${transfermarktId} → TIMEOUT`)
      throw new TransfermarktApiTimeoutError()
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function syncTransfermarktValues(): Promise<TransfermarktSyncResult> {
  const rows = await db
    .select({ id: teams.id, transfermarktId: teams.transfermarktId })
    .from(teams)
    .where(isNotNull(teams.transfermarktId))

  const teamsWithTmId = rows.filter(
    (t): t is TransfermarktTeamRow => t.transfermarktId !== null
  )

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const team of teamsWithTmId) {
    try {
      const marketValue = await fetchClubValue(team.transfermarktId)

      if (marketValue === null || marketValue === 0) {
        console.log(`[transfermarkt] team ${team.transfermarktId} → skipped (value: ${marketValue})`)
        skipped++
        continue
      }

      await db
        .update(teams)
        .set({ squadMarketValue: marketValue, updatedAt: new Date() })
        .where(eq(teams.id, team.id))

      console.log(`[transfermarkt] team ${team.transfermarktId} → DB updated: ${marketValue}`)
      updated++
    } catch (err: unknown) {
      skipped++
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`[transfermarkt] team ${team.transfermarktId} → ERROR: ${msg}`)
      errors.push(`team ${team.transfermarktId}: ${msg}`)
    }
  }

  return { updated, skipped, errors }
}
