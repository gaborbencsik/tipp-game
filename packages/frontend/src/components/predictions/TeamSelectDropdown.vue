<template>
  <select
    :value="modelValue ?? ''"
    class="w-full border rounded px-2 py-1.5 text-sm"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
  >
    <option value="" disabled>{{ $t('teamSelect.placeholder') }}</option>
    <option v-for="t in teamsList" :key="t.id" :value="t.id">{{ t.name }}</option>
  </select>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type { Team, LeagueTeam } from '../../types/index.js'

const props = defineProps<{ modelValue: string | null; leagueId?: string | null }>()
defineEmits<{ 'update:modelValue': [value: string | null] }>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const teamsList = ref<Array<Team | LeagueTeam>>([])

async function loadTeams(): Promise<void> {
  try {
    const token = await getAccessToken()
    teamsList.value = props.leagueId
      ? await api.leagueTeams.forLeague(token, props.leagueId)
      : await api.teams.list(token)
  } catch { /* ignore */ }
}

watch(() => props.leagueId, loadTeams, { immediate: true })

function displayName(id: string | null): string {
  if (!id) return ''
  return teamsList.value.find(t => t.id === id)?.name ?? id
}

defineExpose({ displayName, teamsList })
</script>
