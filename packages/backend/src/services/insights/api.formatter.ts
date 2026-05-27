export interface InsightRowForApi {
  readonly type: string
  readonly data: unknown
  readonly titleHu: string | null
  readonly bodyHu: string | null
  readonly translatedAt: Date | null
}

export interface ApiInsight {
  readonly type: string
  readonly title: string
  readonly body: string
  readonly titleHu: string
  readonly bodyHu: string
  readonly dataPoints: Record<string, number>
  readonly translatedAt: string | null
}

interface InsightContent {
  readonly title: string
  readonly body: string
  readonly dataPoints: Record<string, number>
}

function extractContent(data: unknown): InsightContent {
  if (!data || typeof data !== 'object') {
    return { title: '', body: '', dataPoints: {} }
  }
  const obj = data as Record<string, unknown>
  const title = typeof obj['title'] === 'string' ? (obj['title'] as string) : ''
  const body = typeof obj['body'] === 'string' ? (obj['body'] as string) : ''
  const dpRaw = obj['dataPoints']
  const dataPoints: Record<string, number> = {}
  if (dpRaw && typeof dpRaw === 'object') {
    for (const [k, v] of Object.entries(dpRaw)) {
      if (typeof v === 'number') dataPoints[k] = v
    }
  }
  return { title, body, dataPoints }
}

export function toApiInsight(row: InsightRowForApi): ApiInsight {
  const content = extractContent(row.data)
  return {
    type: row.type,
    title: content.title,
    body: content.body,
    titleHu: row.titleHu ?? content.title,
    bodyHu: row.bodyHu ?? content.body,
    dataPoints: content.dataPoints,
    translatedAt: row.translatedAt ? row.translatedAt.toISOString() : null,
  }
}
