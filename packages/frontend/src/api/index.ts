import type { User, Match, MatchesFilters, Prediction, PredictionInput } from '../types/index.js'

const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: optHeaders, ...restOptions } = options ?? {}
  const response = await fetch(`${BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...optHeaders,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
    throw new Error(body.error ?? response.statusText)
  }

  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; timestamp: string }>('/health'),
  auth: {
    me: (token: string) =>
      request<User>('/auth/me', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  matches: {
    list: (token: string, filters?: MatchesFilters) => {
      const params = new URLSearchParams()
      if (filters?.stage) params.set('stage', filters.stage)
      if (filters?.status) params.set('status', filters.status)
      const query = params.toString() ? `?${params.toString()}` : ''
      return request<Match[]>(`/matches${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
  },
  predictions: {
    mine: (token: string, userId: string) =>
      request<Prediction[]>(`/users/${userId}/predictions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    upsert: (token: string, input: PredictionInput) =>
      request<Prediction>('/predictions', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
}
