<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Mérkőzések</h1>
        <div class="flex items-center gap-2">
          <router-link
            v-if="isAdmin"
            to="/admin/teams"
            class="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Admin – Csapatok
          </router-link>
          <button
            class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            @click="authStore.logout()"
          >
            Kijelentkezés
          </button>
        </div>
      </div>

      <div class="flex gap-2 mb-6">
        <button
          class="px-3 py-1 text-sm rounded"
          :class="!matchesStore.stageFilter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = null"
        >
          Összes
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'group'"
        >
          Csoportkör
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter && matchesStore.stageFilter !== 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'round_of_16'"
        >
          Egyenes kiesés
        </button>
      </div>

      <div v-if="matchesStore.isLoading" class="flex justify-center py-16">
        <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="matchesStore.error" class="bg-red-50 border border-red-200 text-red-700 rounded p-4">
        {{ matchesStore.error }}
      </div>

      <div v-else-if="matchesStore.matchesByDate.length === 0" class="text-center text-gray-500 py-16">
        Nincs megjeleníthető mérkőzés.
      </div>

      <div v-else>
        <div
          v-for="group in matchesStore.matchesByDate"
          :key="group.date"
          class="mb-8"
        >
          <h2 class="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            {{ group.label }}
          </h2>

          <div
            v-for="match in group.matches"
            :key="match.id"
            class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-3"
          >
            <router-link
              :to="`/matches/${match.id}`"
              class="block"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {{ stageLabel(match.stage) }}
                  <span v-if="match.groupName"> – {{ match.groupName }} csoport</span>
                </span>
                <span
                  class="text-xs font-bold px-2 py-0.5 rounded"
                  :class="statusClass(match.status)"
                >
                  {{ statusLabel(match.status) }}
                </span>
              </div>

              <div class="flex items-center justify-center gap-4">
                <span class="font-semibold text-gray-800 text-right flex-1">{{ match.homeTeam.name }}</span>

                <div class="text-xl font-bold text-gray-900 min-w-[5rem] text-center">
                  <template v-if="match.result">
                    {{ match.result.homeGoals }} – {{ match.result.awayGoals }}
                  </template>
                  <template v-else>
                    {{ formatTime(match.scheduledAt) }}
                  </template>
                </div>

                <span class="font-semibold text-gray-800 text-left flex-1">{{ match.awayTeam.name }}</span>
              </div>

              <div v-if="match.venue" class="text-xs text-gray-400 text-center mt-1">
                {{ match.venue.city }}
              </div>
            </router-link>

            <!-- Tipp szekció -->
            <div class="mt-3 pt-3 border-t border-gray-100">
              <!-- Tippelhető meccs -->
              <template v-if="isTippable(match)">
                <div class="flex items-center gap-2 justify-center">
                  <input
                    :value="draftGoals[match.id]?.home ?? ''"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    data-testid="input-home"
                    class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    @input="onGoalInput(match.id, 'home', ($event.target as HTMLInputElement).value)"
                  />
                  <span class="text-gray-400 text-sm">–</span>
                  <input
                    :value="draftGoals[match.id]?.away ?? ''"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    data-testid="input-away"
                    class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    @input="onGoalInput(match.id, 'away', ($event.target as HTMLInputElement).value)"
                  />
                  <button
                    class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    data-testid="save-button"
                    @click="savePrediction(match.id)"
                  >
                    {{ predictionsStore.saveStatus[match.id] === 'saving' ? 'Mentés...' : 'Mentés' }}
                  </button>
                </div>
                <div class="text-center mt-1 text-xs">
                  <span
                    v-if="predictionsStore.saveStatus[match.id] === 'saved'"
                    class="text-green-600"
                    data-testid="save-success"
                  >
                    Tipp elmentve! ✓
                  </span>
                  <span
                    v-else-if="predictionsStore.saveStatus[match.id] === 'error'"
                    class="text-red-500"
                  >
                    {{ predictionsStore.error }}
                  </span>
                  <span
                    v-else-if="predictionsStore.predictionByMatchId(match.id)"
                    class="text-gray-400"
                  >
                    Utoljára módosítva: {{ formatDateTime(predictionsStore.predictionByMatchId(match.id)!.updatedAt) }}
                  </span>
                </div>
              </template>

              <!-- Lezárt meccs -->
              <template v-else>
                <div class="text-center text-xs text-gray-400">
                  <span v-if="predictionsStore.predictionByMatchId(match.id)" class="mr-2">
                    Az én tippem:
                    <strong class="text-gray-600">
                      {{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }}
                      –
                      {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}
                    </strong>
                  </span>
                  <span>Tippelés lezárva</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useMatchesStore } from '../stores/matches.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import type { Match, MatchStage, MatchStatus } from '../types/index.js'

const matchesStore = useMatchesStore()
const authStore = useAuthStore()
const predictionsStore = usePredictionsStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

const now = ref(new Date())
const draftGoals = ref<Record<string, { home: number | null, away: number | null }>>({})

onMounted(async () => {
  await matchesStore.fetchMatches()
  await predictionsStore.fetchMyPredictions()
  initDrafts()
})

function initDrafts(): void {
  for (const match of matchesStore.matches) {
    const existing = predictionsStore.predictionByMatchId(match.id)
    if (existing) {
      draftGoals.value[match.id] = { home: existing.homeGoals, away: existing.awayGoals }
    }
  }
}

function isTippable(match: Match): boolean {
  return match.status === 'scheduled' && new Date(match.scheduledAt) > now.value
}

function onGoalInput(matchId: string, side: 'home' | 'away', raw: string): void {
  const val = raw === '' ? null : Math.min(99, Math.max(0, parseInt(raw, 10)))
  const current = draftGoals.value[matchId] ?? { home: null, away: null }
  draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
}

async function savePrediction(matchId: string): Promise<void> {
  const draft = draftGoals.value[matchId]
  if (draft?.home == null || draft?.away == null) return
  await predictionsStore.upsertPrediction({
    matchId,
    homeGoals: draft.home,
    awayGoals: draft.away,
  })
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'live': return 'ÉLŐBEN'
    case 'finished': return 'Befejezett'
    case 'scheduled': return 'Tervezett'
    case 'cancelled': return 'Törölve'
  }
}

function statusClass(status: MatchStatus): string {
  switch (status) {
    case 'live': return 'bg-red-500 text-white'
    case 'finished': return 'bg-gray-200 text-gray-600'
    case 'scheduled': return 'bg-blue-100 text-blue-700'
    case 'cancelled': return 'bg-gray-100 text-gray-400'
  }
}

function stageLabel(stage: MatchStage): string {
  switch (stage) {
    case 'group': return 'Csoportkör'
    case 'round_of_16': return 'Nyolcaddöntő'
    case 'quarter_final': return 'Negyeddöntő'
    case 'semi_final': return 'Elődöntő'
    case 'third_place': return 'Bronzmérkőzés'
    case 'final': return 'Döntő'
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
</script>
