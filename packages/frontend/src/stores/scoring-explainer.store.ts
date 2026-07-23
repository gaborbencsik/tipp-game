import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { useToastStore } from './toast.store.js'
import { useAuthStore } from './auth.store.js'
import { useScoringRulesConfig } from '../composables/useScoringRulesConfig.js'
import type { ScoringExplainerResponse } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

function track(event: string, props: Record<string, unknown>): void {
  console.debug('[telemetry]', event, props)
}

export type ScoringExplainerSource = 'menu' | 'leaderboard' | 'group' | 'match-tip' | 'special-tip'

export const useScoringExplainerStore = defineStore('scoringExplainer', () => {
  const isOpen = ref(false)
  const data = ref<ScoringExplainerResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastSource = ref<ScoringExplainerSource | null>(null)
  const openedAt = ref<number | null>(null)

  async function open(source: ScoringExplainerSource): Promise<void> {
    if (!useScoringRulesConfig().isScoringRulesEnabled) {
      console.debug('[ScoringExplainer] disabled, ignoring open() call')
      return
    }
    lastSource.value = source
    if (data.value) {
      isOpen.value = true
      emitOpened(source)
      return
    }
    const token = await getAccessToken()
    if (!token) return
    loading.value = true
    error.value = null
    try {
      data.value = await api.scoring.explainer(token)
      isOpen.value = true
      emitOpened(source)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      const { t } = useI18n()
      const toast = useToastStore()
      toast.addToast(t('scoringExplainer.fetchError'), 'error')
    } finally {
      loading.value = false
    }
  }

  function emitOpened(source: ScoringExplainerSource): void {
    const groupCount: '1' | '2+' = (data.value && data.value.groups.length === 1) ? '1' : '2+'
    const auth = useAuthStore()
    track('scoring_explainer_opened', { source, groupCount, userId: auth.user?.id ?? null })
    openedAt.value = Date.now()
  }

  function close(): void {
    isOpen.value = false
    if (openedAt.value !== null) {
      track('scoring_explainer_closed', { durationMs: Date.now() - openedAt.value })
      openedAt.value = null
    }
  }

  return { isOpen, data, loading, error, lastSource, open, close }
})
