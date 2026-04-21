import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { WaitlistEntry, WaitlistFilters, WaitlistSource } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

interface MutableWaitlistFilters {
  source: WaitlistSource | undefined
  search: string | undefined
}

export const useAdminWaitlistStore = defineStore('admin-waitlist', () => {
  const entries = ref<WaitlistEntry[]>([])
  const totalCount = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<MutableWaitlistFilters>({
    source: undefined,
    search: undefined,
  })

  async function fetchWaitlist(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      const activeFilters: WaitlistFilters = {
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.search ? { search: filters.search } : {}),
      }
      const result = await api.admin.waitlist.list(token, activeFilters)
      entries.value = result.entries
      totalCount.value = result.totalCount
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  function setSourceFilter(source: WaitlistSource | undefined): void {
    filters.source = source
  }

  function setSearchFilter(search: string): void {
    filters.search = search || undefined
  }

  return { entries, totalCount, isLoading, error, filters, fetchWaitlist, setSourceFilter, setSearchFilter }
})
