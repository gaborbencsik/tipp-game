import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { AdminStatsSummary, AdminStatsUser, AdminStatsMatch } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminStatsStore = defineStore('admin-stats', () => {
  const summary = ref<AdminStatsSummary | null>(null)
  const users = ref<AdminStatsUser[]>([])
  const matches = ref<AdminStatsMatch[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStats(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      const data = await api.admin.stats.get(token)
      summary.value = data.summary
      users.value = data.users
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMatches(): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const data = await api.admin.stats.matches(token)
      matches.value = data.matches
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  return { summary, users, matches, isLoading, error, fetchStats, fetchMatches }
})
