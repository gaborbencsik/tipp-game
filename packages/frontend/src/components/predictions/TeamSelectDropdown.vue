<template>
  <select
    :value="modelValue ?? ''"
    class="w-full border rounded px-2 py-1.5 text-sm"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
  >
    <option value="" disabled>Válassz csapatot...</option>
    <option v-for="t in teamsList" :key="t.id" :value="t.id">{{ t.name }}</option>
  </select>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type { Team } from '../../types/index.js'

defineProps<{ modelValue: string | null }>()
defineEmits<{ 'update:modelValue': [value: string | null] }>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const teamsList = ref<Team[]>([])
const loaded = ref(false)

async function loadTeams(): Promise<void> {
  if (loaded.value) return
  try {
    const token = await getAccessToken()
    teamsList.value = await api.teams.list(token)
    loaded.value = true
  } catch { /* ignore */ }
}

onMounted(loadTeams)

function displayName(id: string | null): string {
  if (!id) return ''
  return teamsList.value.find(t => t.id === id)?.name ?? id
}

defineExpose({ displayName, teamsList })
</script>
