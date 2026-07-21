<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">{{ $t('admin.leagues.title') }}</h1>
    </div>
    <AdminNav />

    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <div v-if="store.isLoading" class="flex justify-center py-16">
      <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>

    <table v-else class="w-full border-collapse">
      <thead>
        <tr class="bg-gray-100">
          <th class="text-left p-2 border">{{ $t('admin.leagues.name') }}</th>
          <th class="text-left p-2 border">{{ $t('admin.leagues.shortName') }}</th>
          <th class="text-left p-2 border">{{ $t('admin.leagues.status') }}</th>
          <th class="text-left p-2 border">{{ $t('admin.leagues.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="league in store.leagues" :key="league.id" data-testid="league-row">
          <td class="p-2 border">{{ league.name }}</td>
          <td class="p-2 border">{{ league.shortName }}</td>
          <td class="p-2 border">
            <span
              v-if="league.archivedAt"
              data-testid="league-archived-badge"
              class="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-600"
            >
              {{ $t('admin.leagues.archivedBadge') }}
            </span>
            <span v-else class="text-gray-400 text-sm">–</span>
          </td>
          <td class="p-2 border">
            <button
              v-if="league.archivedAt"
              :data-testid="`league-restore-btn-${league.id}`"
              class="px-2 py-1 bg-blue-600 text-white rounded text-sm"
              @click="handleRestore(league.id)"
            >
              {{ $t('admin.leagues.restore') }}
            </button>
            <button
              v-else
              :data-testid="`league-archive-btn-${league.id}`"
              class="px-2 py-1 bg-gray-500 text-white rounded text-sm"
              @click="handleArchive(league.id)"
            >
              {{ $t('admin.leagues.archive') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminLeaguesStore } from '../stores/admin-leagues.store.js'
import AppLayout from '../components/AppLayout.vue'
import AdminNav from '../components/admin/AdminNav.vue'

const store = useAdminLeaguesStore()
const { t } = useI18n()

onMounted(() => {
  void store.fetchLeagues()
})

async function handleArchive(id: string): Promise<void> {
  if (!window.confirm(t('admin.leagues.archiveConfirm'))) return
  await store.archiveLeague(id)
}

async function handleRestore(id: string): Promise<void> {
  await store.restoreLeague(id)
}
</script>
