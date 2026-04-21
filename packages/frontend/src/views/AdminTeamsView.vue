<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Csapatok kezelése</h1>
    </div>
    <div class="flex gap-2 mb-6">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
    </div>

    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <button
      data-testid="new-team-btn"
      class="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      @click="openNewForm"
    >
      Új csapat
    </button>

    <form
      v-if="showForm"
      data-testid="team-form"
      class="mb-6 p-4 border rounded bg-gray-50 space-y-3"
      @submit.prevent="submitForm"
    >
      <div>
        <label class="block text-sm font-medium mb-1">Név</label>
        <input
          v-model="formData.name"
          data-testid="form-name"
          maxlength="100"
          required
          class="w-full border rounded px-2 py-1"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Rövidítés (max 3)</label>
        <input
          v-model="formData.shortCode"
          data-testid="form-short-code"
          maxlength="3"
          required
          class="w-full border rounded px-2 py-1"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Típus</label>
        <select
          v-model="formData.teamType"
          data-testid="form-team-type"
          class="w-full border rounded px-2 py-1"
        >
          <option value="national">Válogatott</option>
          <option value="club">Klub</option>
        </select>
      </div>
      <div v-if="formData.teamType === 'national'">
        <label class="block text-sm font-medium mb-1">Ország kód (ISO, pl. de, fr, gb-sct)</label>
        <input
          v-model="formData.countryCode"
          data-testid="form-country-code"
          maxlength="10"
          placeholder="pl. de, fr, es"
          class="w-full border rounded px-2 py-1"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Csoport</label>
        <select
          v-model="formData.group"
          data-testid="form-group"
          class="w-full border rounded px-2 py-1"
        >
          <option value="">– Nincs –</option>
          <option v-for="g in GROUPS" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Zászló URL</label>
        <input
          v-model="formData.flagUrl"
          data-testid="form-flag-url"
          class="w-full border rounded px-2 py-1"
        />
      </div>
      <div class="flex gap-2">
        <button
          type="submit"
          data-testid="form-submit"
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {{ editingId ? 'Mentés' : 'Létrehozás' }}
        </button>
        <button
          type="button"
          data-testid="form-cancel"
          class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          @click="cancelForm"
        >
          Mégse
        </button>
      </div>
    </form>

    <div v-if="store.isLoading" data-testid="spinner" class="text-center py-8">
      Betöltés…
    </div>

    <table v-else class="w-full border-collapse">
      <thead>
        <tr class="bg-gray-100">
          <th class="text-left p-2 border">Röv.</th>
          <th class="text-left p-2 border">Név</th>
          <th class="text-left p-2 border">Csoport</th>
          <th class="text-left p-2 border">Zászló URL</th>
          <th class="text-left p-2 border">Műveletek</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="team in store.teams" :key="team.id" data-testid="team-row">
          <td class="p-2 border">{{ team.shortCode }}</td>
          <td class="p-2 border">{{ team.name }}</td>
          <td class="p-2 border">{{ team.group ?? '–' }}</td>
          <td class="p-2 border">{{ team.flagUrl ?? '–' }}</td>
          <td class="p-2 border space-x-2">
            <button
              :data-testid="`edit-btn-${team.id}`"
              class="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
              @click="openEditForm(team)"
            >
              Szerkesztés
            </button>
            <button
              :data-testid="`delete-btn-${team.id}`"
              class="px-2 py-1 bg-red-600 text-white rounded text-sm"
              @click="handleDelete(team.id)"
            >
              Törlés
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminTeamsStore } from '../stores/admin-teams.store.js'
import type { Team } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const store = useAdminTeamsStore()

const showForm = ref(false)
const editingId = ref<string | null>(null)
const formData = ref<{ name: string; shortCode: string; group: string; flagUrl: string; teamType: 'national' | 'club'; countryCode: string }>({
  name: '', shortCode: '', group: '', flagUrl: '', teamType: 'national', countryCode: '',
})

onMounted(() => {
  void store.fetchTeams()
})

function openNewForm(): void {
  editingId.value = null
  formData.value = { name: '', shortCode: '', group: '', flagUrl: '', teamType: 'national', countryCode: '' }
  showForm.value = true
}

function openEditForm(team: Team): void {
  editingId.value = team.id
  formData.value = {
    name: team.name,
    shortCode: team.shortCode,
    group: team.group ?? '',
    flagUrl: team.flagUrl ?? '',
    teamType: team.teamType,
    countryCode: team.countryCode ?? '',
  }
  showForm.value = true
}

function cancelForm(): void {
  showForm.value = false
  editingId.value = null
}

async function submitForm(): Promise<void> {
  const input = {
    name: formData.value.name,
    shortCode: formData.value.shortCode,
    group: formData.value.group || null,
    flagUrl: formData.value.flagUrl || null,
    teamType: formData.value.teamType,
    countryCode: formData.value.countryCode || null,
  }

  if (editingId.value) {
    await store.updateTeam(editingId.value, input)
  } else {
    await store.createTeam(input)
  }

  if (!store.error) {
    showForm.value = false
    editingId.value = null
  }
}

async function handleDelete(id: string): Promise<void> {
  if (!window.confirm('Biztosan törlöd ezt a csapatot?')) return
  await store.deleteTeam(id)
}
</script>
