import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { useToastStore } from './toast.store.js'
import type { ScoringExplainerResponse } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export type ScoringExplainerSource = 'menu' | 'leaderboard' | 'group' | 'match-tip' | 'special-tip'

export const useScoringExplainerStore = defineStore('scoringExplainer', () => {
  const isOpen = ref(false)
  const data = ref<ScoringExplainerResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastSource = ref<ScoringExplainerSource | null>(null)

  async function open(source: ScoringExplainerSource): Promise<void> {
    lastSource.value = source
    if (data.value) {
      isOpen.value = true
      return
    }
    const token = await getAccessToken()
    if (!token) return
    loading.value = true
    error.value = null
    try {
      data.value = await api.scoring.explainer(token)
      isOpen.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      const { t } = useI18n()
      const toast = useToastStore()
      toast.addToast(t('scoringExplainer.fetchError'), 'error')
    } finally {
      loading.value = false
    }
  }

  function close(): void {
    isOpen.value = false
  }

  return { isOpen, data, loading, error, lastSource, open, close }
})
