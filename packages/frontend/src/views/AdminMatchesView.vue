<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-gray-900">Admin – Mérkőzések</h1>
        <div class="flex items-center gap-2">
          <button
            data-testid="new-match-btn"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            @click="openCreateForm()"
          >
            + Új mérkőzés
          </button>
        </div>
      </div>
      <div class="flex gap-2 mb-6">
        <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
        <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
        <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
        <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      </div>

      <!-- Error banner -->
      <div v-if="store.error" class="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
        {{ store.error }}
      </div>

      <!-- Spinner -->
      <div v-if="store.isLoading" class="flex justify-center py-16">
        <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Create / Edit form -->
      <div v-if="formVisible" data-testid="match-form" class="bg-white rounded-lg shadow-sm border border-gray-100 p-5 mb-6">
        <h2 class="text-base font-semibold text-gray-700 mb-4">
          {{ editingId ? 'Mérkőzés szerkesztése' : 'Új mérkőzés' }}
        </h2>
        <form @submit.prevent="submitForm()">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1">Hazai csapat</label>
              <select
                v-model="form.homeTeamId"
                data-testid="form-home-team"
                required
                class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Válassz csapatot…</option>
                <option v-for="team in teamsStore.teams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Vendég csapat</label>
              <select
                v-model="form.awayTeamId"
                data-testid="form-away-team"
                required
                class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Válassz csapatot…</option>
                <option v-for="team in teamsStore.teams" :key="team.id" :value="team.id">
                  {{ team.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Kezdés (UTC)</label>
              <input
                v-model="form.scheduledAt"
                type="datetime-local"
                data-testid="form-scheduled-at"
                required
                class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Szakasz</label>
              <select
                v-model="form.stage"
                data-testid="form-stage"
                required
                class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="group">Csoportkör</option>
                <option value="round_of_16">Nyolcaddöntő</option>
                <option value="quarter_final">Negyeddöntő</option>
                <option value="semi_final">Elődöntő</option>
                <option value="third_place">Bronzmérkőzés</option>
                <option value="final">Döntő</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Csoport (A–H)</label>
              <input
                v-model="form.groupName"
                type="text"
                maxlength="1"
                placeholder="pl. A"
                data-testid="form-group-name"
                class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">Státusz</label>
              <select
                v-model="form.status"
                data-testid="form-status"
                class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="scheduled">Tervezett</option>
                <option value="live">Élőben</option>
                <option value="finished">Befejezett</option>
                <option value="cancelled">Törölve</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              data-testid="form-submit"
              class="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {{ editingId ? 'Mentés' : 'Létrehozás' }}
            </button>
            <button
              type="button"
              class="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              @click="closeForm()"
            >
              Mégse
            </button>
          </div>
        </form>
      </div>

      <!-- Result form -->
      <div v-if="resultFormMatchId" data-testid="result-form" class="bg-white rounded-lg shadow-sm border border-blue-100 p-5 mb-6">
        <h2 class="text-base font-semibold text-gray-700 mb-4">Eredmény rögzítése</h2>
        <form @submit.prevent="submitResult()">
          <div class="flex items-center gap-4 mb-4">
            <input
              v-model.number="resultForm.homeGoals"
              type="number"
              min="0"
              max="99"
              data-testid="result-home"
              class="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <span class="text-gray-400">–</span>
            <input
              v-model.number="resultForm.awayGoals"
              type="number"
              min="0"
              max="99"
              data-testid="result-away"
              class="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div
            v-if="resultFormIsKnockout && resultForm.homeGoals === resultForm.awayGoals"
            class="mb-4"
          >
            <label class="block text-xs text-gray-500 mb-1">Döntetlen utáni kimenetel</label>
            <select
              v-model="resultForm.outcomeAfterDraw"
              data-testid="result-outcome"
              class="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option :value="null">– nincs megadva –</option>
              <option value="extra_time_home">Hosszabbítás – hazai nyer</option>
              <option value="extra_time_away">Hosszabbítás – vendég nyer</option>
              <option value="penalties_home">Tizenegyes – hazai nyer</option>
              <option value="penalties_away">Tizenegyes – vendég nyer</option>
            </select>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              data-testid="result-submit"
              class="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Rögzítés
            </button>
            <button
              type="button"
              class="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              @click="resultFormMatchId = null"
            >
              Mégse
            </button>
          </div>
        </form>
      </div>

      <!-- Matches table -->
      <div v-if="!store.isLoading" class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr>
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Meccs</th>
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Időpont</th>
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Szakasz</th>
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Státusz</th>
              <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Eredmény</th>
              <th class="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="match in store.matches"
              :key="match.id"
              data-testid="match-row"
              class="border-b border-gray-50 last:border-0"
            >
              <td class="px-4 py-2 font-medium text-gray-800">
                {{ match.homeTeam.name }} – {{ match.awayTeam.name }}
              </td>
              <td class="px-4 py-2 text-gray-500">{{ formatDateTime(match.scheduledAt) }}</td>
              <td class="px-4 py-2 text-gray-500">{{ stageLabel(match.stage) }}</td>
              <td class="px-4 py-2">
                <span class="text-xs font-bold px-2 py-0.5 rounded" :class="statusClass(match.status)">
                  {{ statusLabel(match.status) }}
                </span>
              </td>
              <td class="px-4 py-2 text-gray-600">
                <span v-if="match.result">{{ match.result.homeGoals }} – {{ match.result.awayGoals }}</span>
                <span v-else class="text-gray-300">–</span>
              </td>
              <td class="px-4 py-2 text-right">
                <div class="flex justify-end gap-1">
                  <button
                    :data-testid="`result-btn-${match.id}`"
                    class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    @click="openResultForm(match.id)"
                  >
                    Eredmény
                  </button>
                  <button
                    :data-testid="`edit-btn-${match.id}`"
                    class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    @click="openEditForm(match)"
                  >
                    Szerkesztés
                  </button>
                  <button
                    :data-testid="`delete-btn-${match.id}`"
                    class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    @click="handleDelete(match.id)"
                  >
                    Törlés
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="store.matches.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400 text-sm">
                Nincsenek mérkőzések.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAdminMatchesStore } from '../stores/admin-matches.store.js'
import { useAdminTeamsStore } from '../stores/admin-teams.store.js'
import type { Match, MatchOutcome, MatchStage, MatchStatus } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'

const store = useAdminMatchesStore()
const teamsStore = useAdminTeamsStore()

onMounted(async () => {
  await Promise.all([store.fetchMatches(), teamsStore.fetchTeams()])
})

// ─── Create / Edit form ───────────────────────────────────────────────────────

const formVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  homeTeamId: '',
  awayTeamId: '',
  scheduledAt: '',
  stage: 'group' as MatchStage,
  groupName: '',
  status: 'scheduled' as MatchStatus,
})

function openCreateForm(): void {
  editingId.value = null
  form.value = { homeTeamId: '', awayTeamId: '', scheduledAt: '', stage: 'group', groupName: '', status: 'scheduled' }
  formVisible.value = true
}

function openEditForm(match: Match): void {
  editingId.value = match.id
  form.value = {
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    scheduledAt: match.scheduledAt.slice(0, 16),
    stage: match.stage,
    groupName: match.groupName ?? '',
    status: match.status,
  }
  formVisible.value = true
}

function closeForm(): void {
  formVisible.value = false
  editingId.value = null
}

async function submitForm(): Promise<void> {
  const input = {
    homeTeamId: form.value.homeTeamId,
    awayTeamId: form.value.awayTeamId,
    scheduledAt: new Date(form.value.scheduledAt).toISOString(),
    stage: form.value.stage,
    groupName: form.value.groupName || null,
    status: form.value.status,
  }
  if (editingId.value) {
    await store.updateMatch(editingId.value, input)
  } else {
    await store.createMatch(input)
  }
  if (!store.error) closeForm()
}

// ─── Result form ──────────────────────────────────────────────────────────────

const KNOCKOUT_STAGES: readonly MatchStage[] = ['round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

const resultFormMatchId = ref<string | null>(null)
const resultForm = ref<{ homeGoals: number; awayGoals: number; outcomeAfterDraw: MatchOutcome | null }>({
  homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null,
})

const resultFormIsKnockout = computed((): boolean => {
  if (!resultFormMatchId.value) return false
  const match = store.matches.find(m => m.id === resultFormMatchId.value)
  return match ? KNOCKOUT_STAGES.includes(match.stage) : false
})

function openResultForm(matchId: string): void {
  resultFormMatchId.value = matchId
  resultForm.value = { homeGoals: 0, awayGoals: 0, outcomeAfterDraw: null }
}

async function submitResult(): Promise<void> {
  if (!resultFormMatchId.value) return
  const input = {
    homeGoals: resultForm.value.homeGoals,
    awayGoals: resultForm.value.awayGoals,
    outcomeAfterDraw: resultFormIsKnockout.value && resultForm.value.homeGoals === resultForm.value.awayGoals
      ? resultForm.value.outcomeAfterDraw
      : null,
  }
  await store.setResult(resultFormMatchId.value, input)
  if (!store.error) resultFormMatchId.value = null
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function handleDelete(id: string): Promise<void> {
  if (!confirm('Biztosan törölni szeretnéd ezt a mérkőzést?')) return
  await store.deleteMatch(id)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}
</script>
