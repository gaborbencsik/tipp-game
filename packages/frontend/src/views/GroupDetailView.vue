<template>
  <AppLayout>
    <div class="flex items-center gap-3 mb-6">
      <router-link to="/groups" class="text-blue-600 hover:text-blue-800 text-sm">← Csoportok</router-link>
      <h1 class="text-2xl font-bold text-gray-900">{{ groupName }}</h1>
    </div>

    <div v-if="isLoading" class="text-gray-500">Betöltés...</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>
    <div v-else-if="entries.length === 0" class="text-gray-500">Még nincs ranglista adat.</div>
    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full text-sm table-fixed">
        <colgroup>
          <col class="w-12" />
          <col />
          <col class="w-16" />
          <col class="w-16" />
          <col class="w-16" />
        </colgroup>
        <thead>
          <tr class="border-b border-gray-200 text-gray-500 text-left">
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Játékos</th>
            <th class="px-4 py-3 text-right">Tipp</th>
            <th class="px-4 py-3 text-right">Helyes</th>
            <th class="px-4 py-3 text-right font-semibold">Pont</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="entry.userId"
            class="border-b border-gray-100 last:border-0 transition-colors"
            :class="entry.userId === authStore.user?.id ? 'bg-blue-50' : 'hover:bg-gray-50'"
          >
            <td class="px-4 py-3 text-gray-400 font-medium">{{ entry.rank }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-2 min-w-0">
                <img
                  :src="entry.avatarUrl ?? dicebearUrl(entry.displayName)"
                  :alt="entry.displayName"
                  class="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <span class="font-medium text-gray-800 truncate">{{ entry.displayName }}</span>
                <span v-if="entry.userId === authStore.user?.id" class="text-xs text-blue-600 shrink-0">(te)</span>
              </div>
            </td>
            <td class="px-4 py-3 text-right text-gray-600">{{ entry.predictionCount }}</td>
            <td class="px-4 py-3 text-right text-gray-600">{{ entry.correctCount }}</td>
            <td class="px-4 py-3 text-right font-bold text-blue-700">{{ entry.totalPoints }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { LeaderboardEntry } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const route = useRoute()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const groupId = route.params.id as string
const entries = ref<LeaderboardEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const groupName = computed(() => groupsStore.groups.find(g => g.id === groupId)?.name ?? 'Csoport')

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    if (groupsStore.groups.length === 0) await groupsStore.fetchMyGroups()
    const token = await getAccessToken()
    entries.value = await api.groups.leaderboard(token, groupId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isLoading.value = false
  }
})
</script>
