<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Játékosok kezelése</h1>
    </div>
    <div class="flex gap-2 mb-6 flex-wrap">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
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

    <!-- Filters + New button -->
    <div class="flex items-center gap-3 mb-4">
      <button
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        @click="openNewForm"
      >
        Új játékos
      </button>
      <select
        v-model="filterTeamId"
        class="border rounded px-2 py-1.5 text-sm"
        @change="onFilterChange"
      >
        <option value="">Összes csapat</option>
        <option v-for="t in teamsStore.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <span class="text-sm text-gray-500">{{ store.players.length }} játékos</span>
    </div>

    <!-- Form -->
    <form
      v-if="showForm"
      class="mb-6 p-4 border rounded bg-gray-50 space-y-3 max-w-lg"
      @submit.prevent="submitForm"
    >
      <div>
        <label class="block text-sm font-medium mb-1">Név *</label>
        <input
          v-model="formData.name"
          maxlength="100"
          required
          class="w-full border rounded px-2 py-1"
        />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Csapat</label>
        <select v-model="formData.teamId" class="w-full border rounded px-2 py-1">
          <option value="">– Nincs –</option>
          <option v-for="t in teamsStore.teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>
      <div class="flex gap-4">
        <div class="flex-1">
          <label class="block text-sm font-medium mb-1">Pozíció</label>
          <select v-model="formData.position" class="w-full border rounded px-2 py-1">
            <option value="">– Nincs –</option>
            <option v-for="pos in POSITIONS" :key="pos.value" :value="pos.value">{{ pos.label }}</option>
          </select>
        </div>
        <div class="w-24">
          <label class="block text-sm font-medium mb-1">Mezszám</label>
          <input
            v-model.number="formData.shirtNumber"
            type="number"
            min="1"
            max="99"
            class="w-full border rounded px-2 py-1 text-center"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          type="submit"
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          {{ editingId ? 'Mentés' : 'Létrehozás' }}
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          @click="cancelForm"
        >
          Mégse
        </button>
      </div>
    </form>

    <div v-if="store.isLoading" class="text-center py-8">Betöltés…</div>

    <table v-else class="w-full border-collapse">
      <thead>
        <tr class="bg-gray-100">
          <th class="text-left p-2 border">Név</th>
          <th class="text-left p-2 border">Csapat</th>
          <th class="text-left p-2 border">Pozíció</th>
          <th class="text-left p-2 border">Mez</th>
          <th class="text-left p-2 border">Műveletek</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="player in store.players" :key="player.id">
          <td class="p-2 border font-medium">{{ player.name }}</td>
          <td class="p-2 border">{{ player.teamName ?? '–' }}</td>
          <td class="p-2 border">{{ positionLabel(player.position) }}</td>
          <td class="p-2 border">{{ player.shirtNumber ?? '–' }}</td>
          <td class="p-2 border space-x-2">
            <button
              class="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
              @click="openEditForm(player)"
            >
              Szerkesztés
            </button>
            <button
              class="px-2 py-1 bg-red-600 text-white rounded text-sm"
              @click="handleDelete(player.id)"
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
import { useAdminPlayersStore } from '../stores/admin-players.store.js'
import { useAdminTeamsStore } from '../stores/admin-teams.store.js'
import type { Player } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'

const POSITIONS = [
  { value: 'GK', label: 'Kapus' },
  { value: 'DF', label: 'Védő' },
  { value: 'MF', label: 'Középpályás' },
  { value: 'FW', label: 'Csatár' },
]

const store = useAdminPlayersStore()
const teamsStore = useAdminTeamsStore()

const showForm = ref(false)
const editingId = ref<string | null>(null)
const filterTeamId = ref('')
const formData = ref<{ name: string; teamId: string; position: string; shirtNumber: number | null }>({
  name: '', teamId: '', position: '', shirtNumber: null,
})

function positionLabel(pos: string | null): string {
  if (!pos) return '–'
  return POSITIONS.find(p => p.value === pos)?.label ?? pos
}

onMounted(async () => {
  await teamsStore.fetchTeams()
  await store.fetchPlayers()
})

function onFilterChange(): void {
  void store.fetchPlayers(filterTeamId.value || undefined)
}

function openNewForm(): void {
  editingId.value = null
  formData.value = { name: '', teamId: '', position: '', shirtNumber: null }
  showForm.value = true
}

function openEditForm(player: Player): void {
  editingId.value = player.id
  formData.value = {
    name: player.name,
    teamId: player.teamId ?? '',
    position: player.position ?? '',
    shirtNumber: player.shirtNumber,
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
    teamId: formData.value.teamId || null,
    position: formData.value.position || null,
    shirtNumber: formData.value.shirtNumber ?? null,
  }

  if (editingId.value) {
    await store.updatePlayer(editingId.value, input)
  } else {
    await store.createPlayer(input)
  }

  if (!store.error) {
    showForm.value = false
    editingId.value = null
  }
}

async function handleDelete(id: string): Promise<void> {
  if (!window.confirm('Biztosan törlöd ezt a játékost?')) return
  await store.deletePlayer(id)
}
</script>
