<template>
  <AppLayout>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Profil</h1>

      <div class="bg-white rounded shadow p-6 space-y-4">
        <div class="flex justify-center mb-4">
          <img
            :src="avatarSrc"
            alt="Avatar"
            data-testid="avatar"
            class="w-16 h-16 rounded-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <p data-testid="email" class="text-gray-900">{{ authStore.user?.email }}</p>
        </div>

        <form @submit.prevent="save">
          <div class="mb-4">
            <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">Megjelenített név</label>
            <input
              id="displayName"
              v-model="displayName"
              data-testid="displayName-input"
              type="text"
              maxlength="30"
              class="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div v-if="errorMessage" data-testid="error-banner" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {{ errorMessage }}
          </div>

          <div v-if="saveSuccess" data-testid="save-success" class="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            Profil elmentve!
          </div>

          <button
            type="submit"
            data-testid="save-btn"
            :disabled="isSaving"
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ isSaving ? 'Mentés...' : 'Mentés' }}
          </button>
        </form>
      </div>

      <!-- Kedvenc csapat -->
      <div v-if="favStore.leagues.length > 0" class="bg-white rounded shadow p-6 space-y-4 mt-6">
        <h2 class="text-lg font-semibold text-gray-900">Kedvenc csapat</h2>
        <p class="text-sm text-gray-500">Ligánként választhatsz kedvenc csapatot. A liga első meccse után zárolódik.</p>

        <div v-for="league in favStore.leagues" :key="league.id" class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-700 w-32 shrink-0">{{ league.shortName }}</span>

          <div v-if="isFavLocked(league.id)" class="flex items-center gap-2 text-sm text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
            <span>{{ getFavTeamName(league.id) || '—' }}</span>
          </div>

          <select
            v-else
            :value="favStore.favoriteByLeagueId(league.id)?.teamId ?? ''"
            :disabled="favSaveStatus[league.id] === 'saving'"
            :data-testid="`fav-select-${league.id}`"
            class="border rounded px-3 py-1.5 text-sm flex-1 disabled:opacity-50"
            @change="onFavChange(league.id, ($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>Válassz csapatot...</option>
            <option
              v-for="team in favStore.leagueTeamsMap[league.id] ?? []"
              :key="team.id"
              :value="team.id"
            >
              {{ team.name }}
            </option>
          </select>

          <span v-if="favSaveStatus[league.id] === 'saved'" class="text-xs text-green-600" :data-testid="`fav-saved-${league.id}`">Elmentve ✓</span>
          <span v-else-if="favSaveStatus[league.id] === 'error'" class="text-xs text-red-500" :data-testid="`fav-error-${league.id}`">Hiba történt</span>
        </div>

        <div v-if="favError" class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {{ favError }}
        </div>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth.store.js'
import { useLeagueFavoritesStore } from '../stores/league-favorites.store.js'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'

const authStore = useAuthStore()
const favStore = useLeagueFavoritesStore()

const avatarSrc = computed((): string => {
  const user = authStore.user
  if (user?.avatarUrl) return user.avatarUrl
  return dicebearUrl(user?.displayName || user?.email || 'user')
})

const displayName = ref(authStore.user?.displayName ?? '')
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const saveSuccess = ref(false)
const favError = ref<string | null>(null)
const favSaveStatus = reactive<Record<string, 'saving' | 'saved' | 'error' | null>>({})
const favTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function isFavLocked(leagueId: string): boolean {
  return favStore.favoriteByLeagueId(leagueId)?.isLocked ?? false
}

function getFavTeamName(leagueId: string): string {
  const fav = favStore.favoriteByLeagueId(leagueId)
  if (!fav) return ''
  const teams = favStore.leagueTeamsMap[leagueId] ?? []
  return teams.find(t => t.id === fav.teamId)?.name ?? ''
}

async function onFavChange(leagueId: string, teamId: string): Promise<void> {
  if (!teamId) return
  favError.value = null
  favSaveStatus[leagueId] = 'saving'
  if (favTimers[leagueId]) clearTimeout(favTimers[leagueId])
  try {
    await favStore.setFavorite(leagueId, teamId)
    favSaveStatus[leagueId] = 'saved'
    favTimers[leagueId] = setTimeout(() => { favSaveStatus[leagueId] = null }, 3000)
  } catch (e) {
    favSaveStatus[leagueId] = 'error'
    favError.value = e instanceof Error ? e.message : 'Ismeretlen hiba'
  }
}

onMounted(async () => {
  displayName.value = authStore.user?.displayName ?? ''
  await Promise.all([favStore.fetchLeagues(), favStore.fetchFavorites()])
  await Promise.all(favStore.leagues.map(l => favStore.fetchLeagueTeams(l.id)))
})

async function save(): Promise<void> {
  if (!displayName.value.trim()) return
  isSaving.value = true
  errorMessage.value = null
  saveSuccess.value = false
  try {
    await authStore.updateProfile(displayName.value.trim())
    saveSuccess.value = true
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isSaving.value = false
  }
}
</script>
