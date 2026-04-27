<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900">Hivatalos torna tippek</h1>
    </div>
    <div class="flex gap-2 mb-6 flex-wrap">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Meccsek</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/players" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Játékosok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
      <router-link to="/admin/global-types" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Torna tippek</router-link>
    </div>

    <div v-if="store.error" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <button
      class="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      @click="openNewForm"
    >
      Új globális típus
    </button>

    <form
      v-if="showForm"
      class="mb-6 p-4 border rounded bg-gray-50 space-y-3 max-w-lg"
      @submit.prevent="submitForm"
    >
      <div>
        <label class="block text-sm font-medium mb-1">Név *</label>
        <input v-model="formData.name" type="text" maxlength="100" required class="w-full border rounded px-2 py-1" placeholder="pl. Gólkirály" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Leírás</label>
        <input v-model="formData.description" type="text" class="w-full border rounded px-2 py-1" placeholder="Opcionális leírás" />
      </div>
      <div class="flex gap-4">
        <div class="flex-1">
          <label class="block text-sm font-medium mb-1">Típus</label>
          <select v-model="formData.inputType" class="w-full border rounded px-2 py-1" @change="onInputTypeChange">
            <option value="text">Szabad szöveg</option>
            <option value="dropdown">Legördülő</option>
            <option value="team_select">Csapatválasztó</option>
            <option value="player_select">Játékosválasztó</option>
          </select>
        </div>
        <div class="w-24">
          <label class="block text-sm font-medium mb-1">Pont</label>
          <input v-model.number="formData.points" type="number" min="1" max="100" required class="w-full border rounded px-2 py-1 text-center" />
        </div>
      </div>
      <div v-if="formData.inputType === 'dropdown'">
        <label class="block text-sm font-medium mb-1">Opciók (vesszővel elválasztva)</label>
        <input v-model="formData.optionsRaw" type="text" class="w-full border rounded px-2 py-1" placeholder="Messi, Ronaldo, Mbappé" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Határidő *</label>
        <input v-model="formData.deadline" type="datetime-local" required class="w-full border rounded px-2 py-1" />
      </div>
      <div class="flex gap-2">
        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50" :disabled="formSaving">
          {{ editingId ? 'Mentés' : 'Létrehozás' }}
        </button>
        <button type="button" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400" @click="showForm = false">
          Mégse
        </button>
      </div>
    </form>

    <div v-if="store.isLoading" class="text-center py-8">Betöltés...</div>

    <div v-else-if="store.globalTypes.length === 0" class="text-gray-500 text-sm">Még nincs hivatalos torna tipp típus.</div>

    <div v-else class="space-y-3 max-w-2xl">
      <div
        v-for="gt in store.globalTypes"
        :key="gt.id"
        class="border rounded-lg p-4 bg-white"
        :class="{ 'opacity-60': !gt.isActive }"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="font-medium text-gray-800">{{ gt.name }}</p>
              <span v-if="!gt.isActive" class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inaktív</span>
            </div>
            <p v-if="gt.description" class="text-sm text-gray-500 mt-0.5">{{ gt.description }}</p>
            <div class="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
              <span>{{ inputTypeLabel(gt.inputType) }}</span>
              <span>·</span>
              <span>{{ gt.points }} pont</span>
              <span>·</span>
              <span>Határidő: {{ formatDateTime(gt.deadline) }}</span>
            </div>
            <div v-if="gt.options?.length" class="mt-1 text-xs text-gray-400">
              Opciók: {{ (gt.options as string[]).join(', ') }}
            </div>
            <div v-if="gt.correctAnswer" class="mt-1 text-xs text-green-600 font-medium">
              Helyes válasz: {{ gt.inputType === 'team_select' ? teamName(gt.correctAnswer) : gt.correctAnswer }}
            </div>
          </div>
          <div v-if="gt.isActive" class="flex gap-1 shrink-0">
            <button
              class="text-xs px-2 py-1 rounded border border-green-300 text-green-600 hover:bg-green-50"
              @click="openSetAnswer(gt)"
            >
              {{ gt.correctAnswer ? 'Újraértékel' : 'Kiértékel' }}
            </button>
            <button
              class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
              @click="openEditForm(gt)"
            >
              Szerkeszt
            </button>
            <button
              class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
              @click="confirmDeactivateId = gt.id"
            >
              Deaktiválás
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Set correct answer dialog -->
    <div v-if="setAnswerTypeId !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-1 font-semibold">Helyes válasz megadása</p>
        <p class="text-gray-500 text-sm mb-3">{{ setAnswerTypeName }}</p>
        <select
          v-if="setAnswerInputType === 'team_select'"
          v-model="setAnswerValue"
          class="w-full border rounded px-3 py-2 text-sm mb-3"
        >
          <option value="" disabled>Válassz csapatot...</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <input
          v-else
          v-model="setAnswerValue"
          type="text"
          class="w-full border rounded px-3 py-2 text-sm mb-3"
          placeholder="Helyes válasz..."
        />
        <div v-if="setAnswerError" class="text-xs text-red-600 mb-2">{{ setAnswerError }}</div>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700" @click="setAnswerTypeId = null">
            Mégse
          </button>
          <button
            class="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium disabled:opacity-50"
            :disabled="!setAnswerValue.trim() || setAnswerSaving"
            @click="submitSetAnswer"
          >
            Kiértékelés
          </button>
        </div>
      </div>
    </div>

    <!-- Confirm deactivate dialog -->
    <div v-if="confirmDeactivateId !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">Biztosan deaktiválod ezt a hivatalos torna tipp típust?</p>
        <div class="flex gap-3 justify-end">
          <button class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700" @click="confirmDeactivateId = null">
            Mégse
          </button>
          <button class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium" @click="onConfirmDeactivate">
            Deaktiválás
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useAdminGlobalTypesStore } from '../stores/admin-global-types.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { SpecialPredictionType, SpecialTypeInput, Team } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const store = useAdminGlobalTypesStore()

const showForm = ref(false)
const editingId = ref<string | null>(null)
const formSaving = ref(false)
const formData = ref({
  name: '',
  description: '',
  inputType: 'text' as 'text' | 'dropdown' | 'team_select' | 'player_select',
  optionsRaw: '',
  points: 5,
  deadline: '',
})

// Teams (for team_select)
const teams = ref<Team[]>([])
const teamsLoaded = ref(false)

async function loadTeamsIfNeeded(): Promise<void> {
  if (teamsLoaded.value) return
  try {
    const token = await getAccessToken()
    teams.value = await api.teams.list(token)
    teamsLoaded.value = true
  } catch { /* ignore */ }
}

function teamName(teamId: string): string {
  return teams.value.find(t => t.id === teamId)?.name ?? teamId
}

function inputTypeLabel(inputType: string): string {
  switch (inputType) {
    case 'dropdown': return 'Legördülő'
    case 'team_select': return 'Csapatválasztó'
    case 'player_select': return 'Játékosválasztó'
    default: return 'Szabad szöveg'
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Set answer dialog
const setAnswerTypeId = ref<string | null>(null)
const setAnswerTypeName = ref('')
const setAnswerInputType = ref<string>('text')
const setAnswerValue = ref('')
const setAnswerSaving = ref(false)
const setAnswerError = ref<string | null>(null)

const confirmDeactivateId = ref<string | null>(null)

function openNewForm(): void {
  editingId.value = null
  formData.value = { name: '', description: '', inputType: 'text', optionsRaw: '', points: 5, deadline: '' }
  showForm.value = true
}

function openEditForm(gt: SpecialPredictionType): void {
  editingId.value = gt.id
  formData.value = {
    name: gt.name,
    description: gt.description ?? '',
    inputType: gt.inputType,
    optionsRaw: (gt.options as string[] | null)?.join(', ') ?? '',
    points: gt.points,
    deadline: gt.deadline.slice(0, 16),
  }
  showForm.value = true
}

function onInputTypeChange(): void {
  if (formData.value.inputType === 'team_select') loadTeamsIfNeeded()
}

async function submitForm(): Promise<void> {
  formSaving.value = true
  try {
    const options = formData.value.inputType === 'dropdown'
      ? formData.value.optionsRaw.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    const input: SpecialTypeInput = {
      name: formData.value.name,
      description: formData.value.description || undefined,
      inputType: formData.value.inputType,
      options,
      deadline: new Date(formData.value.deadline).toISOString(),
      points: formData.value.points,
    }
    if (editingId.value) {
      await store.updateGlobalType(editingId.value, input)
    } else {
      await store.createGlobalType(input)
    }
    if (!store.error) {
      showForm.value = false
      editingId.value = null
    }
  } finally {
    formSaving.value = false
  }
}

function openSetAnswer(gt: SpecialPredictionType): void {
  setAnswerTypeId.value = gt.id
  setAnswerTypeName.value = gt.name
  setAnswerInputType.value = gt.inputType
  setAnswerValue.value = gt.correctAnswer ?? ''
  setAnswerError.value = null
  if (gt.inputType === 'team_select') loadTeamsIfNeeded()
}

async function submitSetAnswer(): Promise<void> {
  if (!setAnswerTypeId.value || !setAnswerValue.value.trim()) return
  setAnswerSaving.value = true
  setAnswerError.value = null
  try {
    await store.evaluateGlobalType(setAnswerTypeId.value, setAnswerValue.value.trim())
    if (!store.error) {
      setAnswerTypeId.value = null
    } else {
      setAnswerError.value = store.error
    }
  } catch (err) {
    setAnswerError.value = err instanceof Error ? err.message : 'Hiba'
  } finally {
    setAnswerSaving.value = false
  }
}

async function onConfirmDeactivate(): Promise<void> {
  if (!confirmDeactivateId.value) return
  const id = confirmDeactivateId.value
  confirmDeactivateId.value = null
  await store.deactivateGlobalType(id)
}

onMounted(async () => {
  await store.fetchGlobalTypes()
  const types = store.globalTypes
  if (types.some(t => t.inputType === 'team_select')) {
    await loadTeamsIfNeeded()
  }
})
</script>
