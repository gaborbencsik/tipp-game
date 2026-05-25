<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Adatszinkronizáció</h1>
    </div>
    <AdminNav />

    <!-- ─── Mérkőzés szinkronizáció ─────────────────────────────────────── -->
    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="match-sync-section">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Mérkőzés szinkronizáció</h2>

      <!-- Sync mode + help text -->
      <div class="flex flex-col gap-1 mb-3">
        <label for="match-sync-mode" class="text-xs text-gray-600">Szinkron mód</label>
        <div class="flex items-center gap-3 flex-wrap">
          <select
            id="match-sync-mode"
            v-model="syncMode"
            class="border rounded px-3 py-1.5 text-sm"
            @change="updateMode"
          >
            <option value="off">Off – nincs automatikus futás</option>
            <option value="final_only">Final only – csak a befejezett meccsek</option>
            <option value="adaptive">Adaptive – élő meccskor sűrűbben</option>
            <option value="full_live">Full live – percenként, élőben</option>
          </select>
          <span v-if="modeLoading" class="text-xs text-gray-400">Mentés...</span>
          <span v-if="modeSaved" class="text-xs text-green-600">Mentve ✓</span>
        </div>
        <p class="text-xs text-gray-400 mt-1">{{ syncModeHelp }}</p>
      </div>

      <!-- Configured leagues chips -->
      <div v-if="configuredLeagues.length > 0" class="mb-3">
        <p class="text-xs text-gray-600 mb-1">Konfigurált ligák:</p>
        <div class="flex flex-wrap gap-1.5" data-testid="configured-leagues">
          <span
            v-for="league in configuredLeagues"
            :key="league.externalId"
            class="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-100"
          >
            {{ league.name }} <span class="text-blue-400">({{ league.season }})</span>
          </span>
        </div>
      </div>
      <p v-else class="text-xs text-amber-600 mb-3">
        Nincs konfigurált liga (állítsd be a FOOTBALL_INTERNAL_*_LEAGUE_ID env változókat).
      </p>

      <!-- Last run + API quota -->
      <div class="text-xs text-gray-500 space-y-0.5 mb-3">
        <div>
          Utolsó futás:
          <span v-if="lastSyncAt" :title="lastSyncAt.toLocaleString(getDateLocale())">{{ lastSyncRelative }}</span>
          <span v-else class="text-gray-400">Még nem futott</span>
        </div>
        <div>
          API hívások ma: {{ apiCallsToday }}
        </div>
        <div v-if="syncInProgress" class="flex items-center gap-1 text-blue-600 font-medium">
          <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Folyamatban...
        </div>
      </div>

      <!-- Trigger -->
      <div class="flex items-center gap-3 flex-wrap">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="syncing || syncMode === 'off'"
          @click="triggerSync"
        >
          <span v-if="syncing">Szinkronizálás...</span>
          <span v-else>Szinkronizálás indítása</span>
        </button>
        <span v-if="syncMode === 'off'" class="text-xs text-amber-600">
          Off módban nem fut — válassz másik módot.
        </span>
      </div>

      <!-- Results -->
      <div v-if="syncResults.length > 0" class="mt-3 space-y-2">
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

      <p v-if="syncError" class="mt-2 text-sm text-red-600">{{ syncError }}</p>

      <p class="text-xs text-gray-400 mt-2">
        Lekéri a konfigurált ligák csapatait, meccseit és eredményeit az api-football.com-ról.
      </p>
    </section>

    <!-- ─── Polymarket odds szinkronizáció ───────────────────────────────── -->
    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="polymarket-sync-section">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Polymarket odds szinkronizáció</h2>
      <div class="flex items-center gap-3 flex-wrap">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="polymarketEnabled"
            type="checkbox"
            class="sr-only peer"
            @change="updatePolymarket"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">{{ polymarketEnabled ? 'Aktív (5 percenként)' : 'Kikapcsolva' }}</span>
        </label>
        <span v-if="polymarketSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="polymarketSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-2 text-xs text-gray-500">
        Utolsó futás:
        <span v-if="lastPolymarketSyncAt" :title="lastPolymarketSyncAt.toLocaleString(getDateLocale())">{{ relativeTime(lastPolymarketSyncAt) }}</span>
        <span v-else class="text-gray-400">Még nem futott</span>
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

    <!-- ─── Játékos szinkronizáció ───────────────────────────────────────── -->
    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="player-sync-section">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Játékos szinkronizáció</h2>
      <div class="flex items-center gap-3 flex-wrap">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="playerSyncEnabled"
            type="checkbox"
            class="sr-only peer"
            @change="updatePlayerSync"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">{{ playerSyncEnabled ? 'Aktív (napi 1×)' : 'Kikapcsolva' }}</span>
        </label>
        <span v-if="playerSyncSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="playerSyncSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-2 text-xs text-gray-500">
        Utolsó futás:
        <span v-if="lastPlayerSyncAt" :title="lastPlayerSyncAt.toLocaleString(getDateLocale())">{{ relativeTime(lastPlayerSyncAt) }}</span>
        <span v-else class="text-gray-400">Még nem futott</span>
      </div>
      <div class="mt-3 flex items-center gap-3">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="playerSyncing"
          @click="triggerPlayerSync"
        >
          <span v-if="playerSyncing">Szinkronizálás...</span>
          <span v-else>Játékosok szinkronizálása most</span>
        </button>
        <span v-if="playerSyncResult" class="text-xs text-green-600">{{ playerSyncResult }}</span>
        <span v-if="playerSyncError" class="text-xs text-red-600">{{ playerSyncError }}</span>
      </div>
      <p class="text-xs text-gray-400 mt-2">Lekéri a válogatott kereteket és statisztikákat az api-football.com-ról.</p>
    </section>

    <!-- ─── Transfermarkt szinkronizáció ─────────────────────────────────── -->
    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="transfermarkt-sync-section">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Transfermarkt szinkronizáció</h2>
      <div class="flex items-center gap-3 flex-wrap">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="transfermarktEnabled"
            type="checkbox"
            class="sr-only peer"
            @change="updateTransfermarkt"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">{{ transfermarktEnabled ? 'Aktív (napi 1×)' : 'Kikapcsolva' }}</span>
        </label>
        <span v-if="transfermarktSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="transfermarktSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-2 text-xs text-gray-500">
        Utolsó futás:
        <span v-if="lastTransfermarktSyncAt" :title="lastTransfermarktSyncAt.toLocaleString(getDateLocale())">{{ relativeTime(lastTransfermarktSyncAt) }}</span>
        <span v-else class="text-gray-400">Még nem futott</span>
      </div>
      <div class="mt-3 flex items-center gap-3">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="transfermarktSyncing"
          @click="triggerTransfermarktSync"
        >
          <span v-if="transfermarktSyncing">Szinkronizálás...</span>
          <span v-else>Piaci értékek lekérése most</span>
        </button>
        <span v-if="transfermarktSyncResult" class="text-xs text-green-600">{{ transfermarktSyncResult }}</span>
        <span v-if="transfermarktSyncError" class="text-xs text-red-600">{{ transfermarktSyncError }}</span>
      </div>
      <p class="text-xs text-gray-400 mt-2">Lekéri a csapatok keret-összértékét a Transfermarkt API-ból.</p>
    </section>

    <!-- ─── Match Pulse raw statisztikák ─────────────────────────────────── -->
    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="raw-stats-sync-section">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Match Pulse raw statisztikák</h2>
      <div class="flex items-center gap-3 flex-wrap">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="rawStatsEnabled"
            type="checkbox"
            class="sr-only peer"
            @change="updateRawStatsEnabled"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">{{ rawStatsEnabled ? 'Aktív' : 'Kikapcsolva' }}</span>
        </label>
        <span v-if="rawStatsSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="rawStatsSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-2 flex items-center gap-3">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="rawStatsSkipFresh"
            type="checkbox"
            class="sr-only peer"
            @change="updateRawStatsSkipFresh"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">24h-nál frissebbet kihagy</span>
        </label>
        <span v-if="rawStatsSkipFreshSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="rawStatsSkipFreshSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-2 text-xs text-gray-500">
        Utolsó futás:
        <span v-if="lastRawStatsSyncAt" :title="lastRawStatsSyncAt.toLocaleString(getDateLocale())">{{ relativeTime(lastRawStatsSyncAt) }}</span>
        <span v-else class="text-gray-400">Még nem futott</span>
      </div>
      <div class="mt-3 flex items-center gap-3">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="rawStatsSyncing"
          @click="triggerRawStatsSync"
        >
          <span v-if="rawStatsSyncing">Lekérés...</span>
          <span v-else>Raw stats lekérése most</span>
        </button>
        <span v-if="rawStatsSyncResult" class="text-xs text-green-600">{{ rawStatsSyncResult }}</span>
        <span v-if="rawStatsSyncError" class="text-xs text-red-600">{{ rawStatsSyncError }}</span>
      </div>
      <div v-if="rawStatsErrors.length > 0" class="mt-2 text-xs text-red-600 space-y-0.5">
        <div v-for="err in rawStatsErrors.slice(0, 5)" :key="err.matchId">
          {{ err.matchId.slice(0, 8) }}…: {{ err.error }}
        </div>
        <div v-if="rawStatsErrors.length > 5" class="text-gray-500">
          + további {{ rawStatsErrors.length - 5 }} hiba
        </div>
      </div>
      <p class="text-xs text-gray-400 mt-2">
        Az összes 'scheduled' meccshez lekéri a két csapat 24 hónapos statisztikáit (api-football.com).
        Egy csapat statjai csak egyszer kérődnek le futás közben.
      </p>
    </section>

    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="insights-sync-section">
      <h2 class="text-sm font-semibold text-gray-700 mb-3">Match Pulse AI insightok</h2>
      <div class="flex items-center gap-3 flex-wrap">
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            v-model="insightsEnabled"
            type="checkbox"
            class="sr-only peer"
            @change="updateInsightsEnabled"
          />
          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-sm text-gray-600">{{ insightsEnabled ? 'Aktív' : 'Kikapcsolva' }}</span>
        </label>
        <span v-if="insightsSaving" class="text-xs text-gray-400">Mentés...</span>
        <span v-if="insightsSaved" class="text-xs text-green-600">Mentve ✓</span>
      </div>
      <div class="mt-2 text-xs text-gray-500">
        Utolsó futás:
        <span v-if="lastInsightsSyncAt" :title="lastInsightsSyncAt.toLocaleString(getDateLocale())">{{ relativeTime(lastInsightsSyncAt) }}</span>
        <span v-else class="text-gray-400">Még nem futott</span>
      </div>
      <div v-if="insightsUsage" class="mt-2 text-xs text-gray-600" data-testid="insights-usage">
        Ma: {{ insightsUsage.requestsToday }} / {{ insightsUsage.dailyLimit }} kérés ({{ insightsUsage.remaining }} maradt)
      </div>
      <div class="mt-3 flex items-center gap-3 flex-wrap">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="insightsSyncing"
          data-testid="insights-run-btn"
          @click="triggerInsightsSync"
        >
          <span v-if="insightsSyncing">Generálás...</span>
          <span v-else>Generálás indítása</span>
        </button>
        <span v-if="insightsSyncResult" class="text-xs text-green-600">{{ insightsSyncResult }}</span>
        <span v-if="insightsSyncError" class="text-xs text-red-600" data-testid="insights-error">{{ insightsSyncError }}</span>
      </div>
      <div v-if="insightsErrors.length > 0" class="mt-2 text-xs text-red-600 space-y-0.5">
        <div v-for="err in insightsErrors.slice(0, 5)" :key="err.matchId">
          {{ err.matchId.slice(0, 8) }}…: {{ err.error }}
        </div>
        <div v-if="insightsErrors.length > 5" class="text-gray-500">
          + további {{ insightsErrors.length - 5 }} hiba
        </div>
      </div>
      <p class="text-xs text-gray-400 mt-2">
        Az összes 'scheduled' meccshez 5 AI insight-ot generál a Gemini API-val.
        Rate limit: 15 RPM. Napi keret: {{ insightsUsage?.dailyLimit ?? 450 }}.
      </p>
    </section>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import AdminNav from '../components/admin/AdminNav.vue'
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

interface ConfiguredLeague {
  name: string
  externalId: number
  season: number
}

const SYNC_MODE_HELP: Record<string, string> = {
  off: 'A cron nem fut, csak kézi indítás.',
  final_only: 'Csak a már lejátszott meccsek eredményét frissíti.',
  adaptive: 'Élő meccs alatt percenként, egyébként ritkábban fut.',
  full_live: 'Folyamatosan, percenként frissít minden meccset.',
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
const lastPolymarketSyncAt = ref<Date | null>(null)

const playerSyncEnabled = ref(false)
const playerSyncSaving = ref(false)
const playerSyncSaved = ref(false)
const playerSyncing = ref(false)
const playerSyncResult = ref('')
const playerSyncError = ref('')
const lastPlayerSyncAt = ref<Date | null>(null)

const transfermarktEnabled = ref(false)
const transfermarktSaving = ref(false)
const transfermarktSaved = ref(false)
const transfermarktSyncing = ref(false)
const transfermarktSyncResult = ref('')
const transfermarktSyncError = ref('')
const lastTransfermarktSyncAt = ref<Date | null>(null)

const rawStatsEnabled = ref(false)
const rawStatsSaving = ref(false)
const rawStatsSaved = ref(false)
const rawStatsSkipFresh = ref(false)
const rawStatsSkipFreshSaving = ref(false)
const rawStatsSkipFreshSaved = ref(false)
const rawStatsSyncing = ref(false)
const rawStatsSyncResult = ref('')
const rawStatsSyncError = ref('')
const rawStatsErrors = ref<Array<{ matchId: string; error: string }>>([])
const lastRawStatsSyncAt = ref<Date | null>(null)

const insightsEnabled = ref(false)
const insightsSaving = ref(false)
const insightsSaved = ref(false)
const insightsSyncing = ref(false)
const insightsSyncResult = ref('')
const insightsSyncError = ref('')
const insightsErrors = ref<Array<{ matchId: string; error: string }>>([])
const lastInsightsSyncAt = ref<Date | null>(null)
interface InsightsUsage {
  date: string
  requestsToday: number
  inputTokensToday: number
  outputTokensToday: number
  dailyLimit: number
  remaining: number
  last7Days: Array<{ date: string; requests: number; tokens: number }>
}
const insightsUsage = ref<InsightsUsage | null>(null)

const lastSyncAt = ref<Date | null>(null)
const apiCallsToday = ref(0)
const syncInProgress = ref(false)
const configuredLeagues = ref<ConfiguredLeague[]>([])

const syncModeHelp = computed((): string => SYNC_MODE_HELP[syncMode.value] ?? '')

function relativeTime(date: Date | null): string {
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'most'
  if (minutes < 60) return `${minutes} perce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} órája`
  return `${Math.floor(hours / 24)} napja`
}

const lastSyncRelative = computed((): string => relativeTime(lastSyncAt.value))

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
  lastPolymarketSyncAt.value = data.lastPolymarketSyncAt ? new Date(data.lastPolymarketSyncAt) : null
  playerSyncEnabled.value = data.playerSyncEnabled ?? false
  lastPlayerSyncAt.value = data.lastPlayerSyncAt ? new Date(data.lastPlayerSyncAt) : null
  transfermarktEnabled.value = data.transfermarktSyncEnabled ?? false
  lastTransfermarktSyncAt.value = data.lastTransfermarktSyncAt ? new Date(data.lastTransfermarktSyncAt) : null
  rawStatsEnabled.value = data.rawStatsSyncEnabled ?? false
  rawStatsSkipFresh.value = data.rawStatsSkipFresh ?? false
  lastRawStatsSyncAt.value = data.lastRawStatsSyncAt ? new Date(data.lastRawStatsSyncAt) : null
  insightsEnabled.value = data.insightsSyncEnabled ?? false
  lastInsightsSyncAt.value = data.lastInsightsSyncAt ? new Date(data.lastInsightsSyncAt) : null
  configuredLeagues.value = data.configuredLeagues ?? []
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
    await loadSettings()
  } catch (err) {
    polymarketSyncError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    polymarketSyncing.value = false
  }
}

async function updatePlayerSync(): Promise<void> {
  playerSyncSaving.value = true
  playerSyncSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { playerSyncEnabled: playerSyncEnabled.value })
  playerSyncSaving.value = false
  playerSyncSaved.value = true
  setTimeout(() => { playerSyncSaved.value = false }, 2000)
}

async function triggerPlayerSync(): Promise<void> {
  playerSyncing.value = true
  playerSyncResult.value = ''
  playerSyncError.value = ''
  try {
    const token = await getToken()
    const data = await api.admin.sync.runPlayers(token)
    playerSyncResult.value = `Kész: ${data.inserted} új, ${data.updated} frissítve, ${data.statsUpserted} stat`
    await loadSettings()
  } catch (err) {
    playerSyncError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    playerSyncing.value = false
  }
}

async function updateTransfermarkt(): Promise<void> {
  transfermarktSaving.value = true
  transfermarktSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { transfermarktSyncEnabled: transfermarktEnabled.value })
  transfermarktSaving.value = false
  transfermarktSaved.value = true
  setTimeout(() => { transfermarktSaved.value = false }, 2000)
}

async function triggerTransfermarktSync(): Promise<void> {
  transfermarktSyncing.value = true
  transfermarktSyncResult.value = ''
  transfermarktSyncError.value = ''
  try {
    const token = await getToken()
    const data = await api.admin.sync.runTransfermarkt(token)
    transfermarktSyncResult.value = `Kész: ${data.updated} frissítve, ${data.skipped} kihagyva`
    await loadSettings()
  } catch (err) {
    transfermarktSyncError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    transfermarktSyncing.value = false
  }
}

async function updateRawStatsEnabled(): Promise<void> {
  rawStatsSaving.value = true
  rawStatsSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { rawStatsSyncEnabled: rawStatsEnabled.value })
  rawStatsSaving.value = false
  rawStatsSaved.value = true
  setTimeout(() => { rawStatsSaved.value = false }, 2000)
}

async function updateRawStatsSkipFresh(): Promise<void> {
  rawStatsSkipFreshSaving.value = true
  rawStatsSkipFreshSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { rawStatsSkipFresh: rawStatsSkipFresh.value })
  rawStatsSkipFreshSaving.value = false
  rawStatsSkipFreshSaved.value = true
  setTimeout(() => { rawStatsSkipFreshSaved.value = false }, 2000)
}

async function triggerRawStatsSync(): Promise<void> {
  rawStatsSyncing.value = true
  rawStatsSyncResult.value = ''
  rawStatsSyncError.value = ''
  rawStatsErrors.value = []
  try {
    const token = await getToken()
    const data = await api.admin.sync.runRawStats(token)
    const seconds = (data.durationMs / 1000).toFixed(1)
    rawStatsSyncResult.value = `Kész: ${data.processed} feldolgozva, ${data.skipped} kihagyva, ${data.errors.length} hiba (${data.apiCalls} API call, ${seconds}s)`
    rawStatsErrors.value = data.errors
    await loadSettings()
  } catch (err) {
    rawStatsSyncError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    rawStatsSyncing.value = false
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

async function updateInsightsEnabled(): Promise<void> {
  insightsSaving.value = true
  insightsSaved.value = false
  const token = await getToken()
  await api.admin.sync.updateSettings(token, { insightsSyncEnabled: insightsEnabled.value })
  insightsSaving.value = false
  insightsSaved.value = true
  setTimeout(() => { insightsSaved.value = false }, 2000)
}

async function loadInsightsUsage(): Promise<void> {
  try {
    const token = await getToken()
    insightsUsage.value = await api.admin.sync.getInsightsUsage(token)
  } catch { /* ignore */ }
}

async function triggerInsightsSync(): Promise<void> {
  insightsSyncing.value = true
  insightsSyncResult.value = ''
  insightsSyncError.value = ''
  insightsErrors.value = []
  try {
    const token = await getToken()
    const data = await api.admin.sync.runInsights(token)
    insightsSyncResult.value = `Kész: ${data.generated} generálva, ${data.skipped} kihagyva, ${data.errors.length} hiba`
    insightsErrors.value = data.errors
    await loadSettings()
    await loadInsightsUsage()
  } catch (err) {
    insightsSyncError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    insightsSyncing.value = false
  }
}

onMounted(async () => {
  await loadSettings()
  await loadInsightsUsage()
})
</script>
