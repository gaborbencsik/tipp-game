<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('leaderboard.title') }}</h1>
      <select
        v-if="groupsStore.groups.length > 0"
        v-model="selectedScope"
        class="h-10 px-3 text-sm text-gray-900 bg-gray-50 border border-gray-300 rounded-lg transition-all duration-150 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 focus:outline-none"
        @change="onScopeChange"
      >
        <option value="global">{{ $t('leaderboard.global') }}</option>
        <option v-for="group in groupsStore.groups" :key="group.id" :value="group.id">
          {{ group.name }}
        </option>
      </select>
    </div>

    <div v-if="isLoading" class="text-gray-500">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>
    <div v-else-if="entries.length === 0" class="text-gray-500">{{ $t('leaderboard.empty') }}</div>
    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full text-sm table-fixed">
        <colgroup>
          <col class="w-10" />
          <col />
          <col class="w-24" />
          <col class="w-24" />
          <col class="w-24" />
        </colgroup>
        <thead>
          <tr class="border-b border-gray-200 text-gray-500 text-left">
            <th class="pl-4 pr-2 py-3">{{ $t('leaderboard.rank') }}</th>
            <th class="px-2 py-3">{{ $t('leaderboard.player') }}</th>
            <th class="px-3 py-3 text-right">{{ $t('leaderboard.tips') }}</th>
            <th class="px-3 py-3 text-right">{{ $t('leaderboard.correct') }}</th>
            <th class="pr-4 pl-2 py-3 text-right font-semibold">{{ $t('leaderboard.points') }}</th>
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
                <span v-if="entry.userId === authStore.user?.id" class="text-xs text-blue-600 shrink-0">{{ $t('leaderboard.you') }}</span>
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
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useLeaderboardStore } from '../stores/leaderboard.store.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { LeaderboardEntry } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

const { t } = useI18n()

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const leaderboardStore = useLeaderboardStore()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const selectedScope = ref<string>('global')
const groupEntries = ref<LeaderboardEntry[]>([])
const groupIsLoading = ref(false)
const groupError = ref<string | null>(null)

const isLoading = computed(() => selectedScope.value === 'global' ? leaderboardStore.isLoading : groupIsLoading.value)
const error = computed(() => selectedScope.value === 'global' ? leaderboardStore.error : groupError.value)
const entries = computed(() => selectedScope.value === 'global' ? leaderboardStore.entries : groupEntries.value)

async function loadGroupLeaderboard(groupId: string): Promise<void> {
  groupIsLoading.value = true
  groupError.value = null
  try {
    const token = await getAccessToken()
    groupEntries.value = await api.groups.leaderboard(token, groupId)
  } catch (err) {
    groupError.value = err instanceof Error ? err.message : t('common.unknownError')
  } finally {
    groupIsLoading.value = false
  }
}

async function onScopeChange(): Promise<void> {
  if (selectedScope.value === 'global') {
    void leaderboardStore.fetchLeaderboard()
  } else {
    await loadGroupLeaderboard(selectedScope.value)
  }
}

onMounted(async () => {
  await Promise.all([
    leaderboardStore.fetchLeaderboard(),
    groupsStore.groups.length === 0 ? groupsStore.fetchMyGroups() : Promise.resolve(),
  ])
})
</script>
