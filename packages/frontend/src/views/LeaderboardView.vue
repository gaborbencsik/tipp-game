<template>
  <AppLayout>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Ranglista</h1>

    <div v-if="leaderboardStore.isLoading" class="text-gray-500">Betöltés...</div>
    <div v-else-if="leaderboardStore.error" class="text-red-600">{{ leaderboardStore.error }}</div>
    <div v-else-if="leaderboardStore.entries.length === 0" class="text-gray-500">Még nincs ranglista adat.</div>
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
            v-for="entry in leaderboardStore.entries"
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
import { onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useLeaderboardStore } from '../stores/leaderboard.store.js'
import { useAuthStore } from '../stores/auth.store.js'

const leaderboardStore = useLeaderboardStore()
const authStore = useAuthStore()

onMounted(() => {
  void leaderboardStore.fetchLeaderboard()
})
</script>
