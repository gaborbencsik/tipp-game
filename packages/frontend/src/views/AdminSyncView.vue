<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Futball API szinkronizáció</h1>
    </div>
    <div class="flex flex-wrap gap-2 mb-6">
      <router-link to="/admin/stats" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Statisztikák</router-link>
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
    <section class="mb-4 p-4 bg-white rounded-lg border">
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

    <!-- Polymarket sync toggle -->
    <section class="mb-4 p-4 bg-white rounded-lg border">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Polymarket odds szinkronizáció</h2>
      <div class="flex items-center gap-3">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="polymarketEnabled"
            type="checkbox"
            class="sr-only peer"
            @change="updatePolymarket"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">{{ polymarketEnabled ? 'Aktív' : 'Kikapcsolva' }}</span>
        </label>
        <span v-if="polymarketSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="polymarketSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-3 flex items-center gap-3">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="polymarketSyncing"
          @click="triggerPolymarketSync"
        >
          <span v-if="polymarketSyncing">Szinkronizálás...</span>
          <span v-else>Odds lekérése most</span>
        </button>
        <span v-if="polymarketSyncResult" class="text-xs text-green-600">{{ polymarketSyncResult }}</span>
        <span v-if="polymarketSyncError" class="text-xs text-red-600">{{ polymarketSyncError }}</span>
      </div>
      <p class="text-xs text-gray-400 mt-2">5 percenként lekéri a Polymarket odds-okat az összes VB meccshez.</p>
    </section>

    <!-- Sync status -->
    <section class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div class="flex items-center justify-between text-sm">
        <div class="space-y-1">
          <div class="text-gray-600">
            <span class="font-medium">Utolsó sync:</span>
            <span v-if="lastSyncAt" :title="lastSyncAt.toLocaleString(getDateLocale())">
              {{ lastSyncRelative }}
            </span>
            <span v-else class="text-gray-400">Még nem futott</span>
          </div>
          <div class="text-gray-600">
            <span class="font-medium">API hívások:</span>
            <span :class="apiCallsRatio > 0.8 ? 'text-red-600 font-semibold' : ''">
              {{ apiCallsToday }} / {{ apiDailyLimit }}
            </span>
          </div>
        </div>
        <div v-if="syncInProgress" class="flex items-center gap-2 text-blue-600 text-xs font-medium">
          <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Folyamatban...
        </div>
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
import { ref, computed, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { getDateLocale } from '../lib/dateLocale.js'

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
const polymarketEnabled = ref(false)
const polymarketSaving = ref(false)
const polymarketSaved = ref(false)
const polymarketSyncing = ref(false)
const polymarketSyncResult = ref('')
const polymarketSyncError = ref('')

const lastSyncAt = ref<Date | null>(null)
const apiCallsToday = ref(0)
const apiDailyLimit = 100
const syncInProgress = ref(false)

const apiCallsRatio = computed((): number => apiCallsToday.value / apiDailyLimit)

const lastSyncRelative = computed((): string => {
  if (!lastSyncAt.value) return ''
  const diff = Date.now() - lastSyncAt.value.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'most'
  if (minutes < 60) return `${minutes} perce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} órája`
  return `${Math.floor(hours / 24)} napja`
})

async function getToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function loadSettings(): Promise<void> {
  const token = await getToken()
  const data = await api.admin.sync.getSettings(token)
  syncMode.value = data.mode
  lastSyncAt.value = data.lastSuccessfulSyncAt ? new Date(data.lastSuccessfulSyncAt) : null
  apiCallsToday.value = data.apiCallsToday ?? 0
  syncInProgress.value = data.syncInProgress ?? false
  polymarketEnabled.value = data.polymarketSyncEnabled ?? false
}

async function updateMode(): Promise<void> {
  modeLoading.value = true
  modeSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { mode: syncMode.value })
  modeLoading.value = false
  modeSaved.value = true
  setTimeout(() => { modeSaved.value = false }, 2000)
}

async function updatePolymarket(): Promise<void> {
  polymarketSaving.value = true
  polymarketSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { polymarketSyncEnabled: polymarketEnabled.value })
  polymarketSaving.value = false
  polymarketSaved.value = true
  setTimeout(() => { polymarketSaved.value = false }, 2000)
}

async function triggerPolymarketSync(): Promise<void> {
  polymarketSyncing.value = true
  polymarketSyncResult.value = ''
  polymarketSyncError.value = ''
  try {
    const token = await getToken()
    const data = await api.admin.sync.runPolymarket(token)
    polymarketSyncResult.value = `Kész: ${data.synced} szinkronizálva, ${data.failed} sikertelen`
  } catch (err) {
    polymarketSyncError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    polymarketSyncing.value = false
  }
}

async function triggerSync(): Promise<void> {
  syncing.value = true
  syncError.value = ''
  syncResults.value = []

  try {
    const token = await getToken()
    const data = await api.admin.sync.run(token)
    syncResults.value = data.results
    await loadSettings()
  } catch (err) {
    syncError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    syncing.value = false
  }
}

onMounted(loadSettings)
</script>
