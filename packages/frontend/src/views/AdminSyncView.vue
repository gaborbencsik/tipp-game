<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Futball API szinkronizáció</h1>
    </div>
    <div class="flex flex-wrap gap-2 mb-6">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/players" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Játékosok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
      <router-link to="/admin/global-types" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Speciális tippek</router-link>
      <router-link to="/admin/sync" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Szinkron</router-link>
    </div>

    <!-- Sync mode -->
    <section class="mb-8 p-4 bg-white rounded-lg border">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Sync mód</h2>
      <div class="flex items-center gap-3">
        <select
          v-model="syncMode"
          class="border rounded px-3 py-1.5 text-sm"
          @change="updateMode"
        >
          <option value="off">Off</option>
          <option value="final_only">Final only</option>
          <option value="adaptive">Adaptive</option>
          <option value="full_live">Full live</option>
        </select>
        <span v-if="modeLoading" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="modeSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
    </section>

    <!-- Manual sync trigger -->
    <section class="p-4 bg-white rounded-lg border">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Manuális szinkronizáció</h2>
      <button
        class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="syncing || syncMode === 'off'"
        @click="triggerSync"
      >
        <span v-if="syncing">Szinkronizálás...</span>
        <span v-else>Szinkronizálás indítása</span>
      </button>

      <p v-if="syncMode === 'off'" class="mt-2 text-xs text-amber-600">
        A sync mód "Off" — először válts másik módra.
      </p>

      <!-- Results -->
      <div v-if="syncResults.length > 0" class="mt-4 space-y-3">
        <div
          v-for="(result, i) in syncResults"
          :key="i"
          class="p-3 rounded text-sm"
          :class="result.partial ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'"
        >
          <div class="font-medium">
            {{ result.partial ? '⚠️ Részleges siker' : '✅ Sikeres' }}
          </div>
          <div class="text-gray-600 mt-1">
            Csapatok: {{ result.teamsUpserted }} |
            Meccsek: {{ result.fixturesUpserted }} |
            Eredmények: {{ result.resultsUpserted }}
          </div>
          <div v-if="result.errors.length > 0" class="mt-1 text-red-600 text-xs">
            {{ result.errors.join(', ') }}
          </div>
        </div>
      </div>

      <!-- Error -->
      <p v-if="syncError" class="mt-3 text-sm text-red-600">{{ syncError }}</p>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

interface SyncResult {
  teamsUpserted: number
  fixturesUpserted: number
  resultsUpserted: number
  errors: string[]
  partial: boolean
}

const syncMode = ref('off')
const modeLoading = ref(false)
const modeSaved = ref(false)
const syncing = ref(false)
const syncResults = ref<SyncResult[]>([])
const syncError = ref('')

async function getToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function loadSettings(): Promise<void> {
  const token = await getToken()
  const data = await api.admin.sync.getSettings(token)
  syncMode.value = data.mode
}

async function updateMode(): Promise<void> {
  modeLoading.value = true
  modeSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, syncMode.value)
  modeLoading.value = false
  modeSaved.value = true
  setTimeout(() => { modeSaved.value = false }, 2000)
}

async function triggerSync(): Promise<void> {
  syncing.value = true
  syncError.value = ''
  syncResults.value = []

  try {
    const token = await getToken()
    const data = await api.admin.sync.run(token)
    syncResults.value = data.results
  } catch (err) {
    syncError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    syncing.value = false
  }
}

onMounted(loadSettings)
</script>
