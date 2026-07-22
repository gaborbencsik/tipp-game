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

    <template v-else>
      <button
        data-testid="league-create-btn"
        class="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        @click="openNewForm"
      >
        {{ $t('admin.leagues.create') }}
      </button>

      <form
        v-if="showForm"
        data-testid="league-form"
        class="mb-6 p-4 border rounded bg-gray-50 space-y-3"
        @submit.prevent="submitForm"
      >
        <div>
          <label class="block text-sm font-medium mb-1">{{ $t('admin.leagues.form.name') }}</label>
          <input v-model="formData.name" data-testid="league-form-name" maxlength="100" class="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">{{ $t('admin.leagues.form.shortName') }}</label>
          <input v-model="formData.shortName" data-testid="league-form-short-name" maxlength="20" class="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">{{ $t('admin.leagues.form.externalId') }}</label>
          <input v-model="formData.externalId" data-testid="league-form-external-id" inputmode="numeric" class="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">{{ $t('admin.leagues.form.season') }}</label>
          <input v-model="formData.season" data-testid="league-form-season" inputmode="numeric" class="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">{{ $t('admin.leagues.form.status') }}</label>
          <select v-model="formData.status" data-testid="league-form-status" class="w-full border rounded px-2 py-1">
            <option value="active">{{ $t('admin.leagues.form.statusActive') }}</option>
            <option value="archived">{{ $t('admin.leagues.form.statusArchived') }}</option>
          </select>
        </div>
        <div>
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="formData.syncEnabled" type="checkbox" data-testid="league-form-sync-enabled" />
            {{ $t('admin.leagues.form.syncEnabled') }}
          </label>
          <p v-if="formData.status === 'archived'" data-testid="league-form-sync-hint" class="mt-1 text-xs text-gray-500">
            {{ $t('admin.leagues.form.syncArchivedHint') }}
          </p>
        </div>
        <div class="flex gap-2">
          <button type="submit" data-testid="league-form-save" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            {{ $t('admin.leagues.form.save') }}
          </button>
          <button type="button" data-testid="league-form-cancel" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400" @click="cancelForm">
            {{ $t('admin.leagues.form.cancel') }}
          </button>
        </div>
      </form>

      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-gray-100">
            <th class="text-left p-2 border">{{ $t('admin.leagues.name') }}</th>
            <th class="text-left p-2 border">{{ $t('admin.leagues.shortName') }}</th>
            <th class="text-left p-2 border">{{ $t('admin.leagues.status') }}</th>
            <th class="text-left p-2 border">{{ $t('admin.leagues.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.leagues.length === 0">
            <td data-testid="leagues-empty" colspan="4" class="p-6 text-center text-gray-400">
              {{ $t('admin.leagues.empty') }}
            </td>
          </tr>
          <tr v-for="league in store.leagues" :key="league.id" data-testid="league-row">
            <td class="p-2 border">{{ league.name }}</td>
            <td class="p-2 border">{{ league.shortName }}</td>
            <td class="p-2 border">
              <span
                v-if="league.status === 'archived'"
                data-testid="league-archived-badge"
                class="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-600"
              >
                {{ $t('admin.leagues.archivedBadge') }}
              </span>
              <span
                v-else
                data-testid="league-active-badge"
                class="inline-block px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700"
              >
                {{ $t('admin.leagues.activeBadge') }}
              </span>
            </td>
            <td class="p-2 border space-x-2">
              <button
                :data-testid="`league-edit-btn-${league.id}`"
                class="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
                @click="openEditForm(league)"
              >
                {{ $t('admin.leagues.edit') }}
              </button>
              <button
                v-if="league.status === 'archived'"
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
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminLeaguesStore } from '../stores/admin-leagues.store.js'
import type { League, LeagueInput } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'
import AdminNav from '../components/admin/AdminNav.vue'

const store = useAdminLeaguesStore()
const { t } = useI18n()

const showForm = ref(false)
const editingId = ref<string | null>(null)
const formData = ref<{
  name: string
  shortName: string
  externalId: string
  season: string
  status: 'active' | 'archived'
  syncEnabled: boolean
}>({ name: '', shortName: '', externalId: '', season: '', status: 'active', syncEnabled: false })

onMounted(() => {
  void store.fetchLeagues()
})

function openNewForm(): void {
  editingId.value = null
  formData.value = { name: '', shortName: '', externalId: '', season: '', status: 'active', syncEnabled: false }
  showForm.value = true
}

function openEditForm(league: League): void {
  editingId.value = league.id
  formData.value = {
    name: league.name,
    shortName: league.shortName,
    externalId: league.externalId != null ? String(league.externalId) : '',
    season: league.season != null ? String(league.season) : '',
    status: league.status,
    syncEnabled: league.syncEnabled,
  }
  showForm.value = true
}

function cancelForm(): void {
  showForm.value = false
  editingId.value = null
}

async function submitForm(): Promise<void> {
  const name = formData.value.name.trim()
  const shortName = formData.value.shortName.trim()
  if (!name || !shortName) return

  const input: LeagueInput = {
    name,
    shortName,
    status: formData.value.status,
    syncEnabled: formData.value.syncEnabled,
    externalId: formData.value.externalId.trim() === '' ? null : Number(formData.value.externalId),
    season: formData.value.season.trim() === '' ? null : Number(formData.value.season),
  }

  if (editingId.value) {
    await store.updateLeague(editingId.value, input)
  } else {
    await store.createLeague(input)
  }

  if (!store.error) {
    showForm.value = false
    editingId.value = null
  }
}

async function handleArchive(id: string): Promise<void> {
  if (!window.confirm(t('admin.leagues.archiveConfirm'))) return
  await store.archiveLeague(id)
}

async function handleRestore(id: string): Promise<void> {
  await store.restoreLeague(id)
}
</script>
