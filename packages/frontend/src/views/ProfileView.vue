<template>
  <AppLayout>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">{{ $t('profile.title') }}</h1>

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
          <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('profile.emailLabel') }}</label>
          <p data-testid="email" class="text-gray-900">{{ authStore.user?.email }}</p>
        </div>

        <form @submit.prevent="save">
          <div class="mb-4">
            <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">{{ $t('profile.displayNameLabel') }}</label>
            <input
              id="displayName"
              v-model="displayName"
              data-testid="displayName-input"
              type="text"
              maxlength="30"
              class="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div class="mb-4">
            <label for="locale" class="block text-sm font-medium text-gray-700 mb-1">{{ $t('profile.localeLabel') }}</label>
            <select
              id="locale"
              v-model="localeDraft"
              data-testid="locale-select"
              class="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="hu">Magyar</option>
              <option value="en">English</option>
            </select>
          </div>

          <div v-if="errorMessage" data-testid="error-banner" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {{ errorMessage }}
          </div>

          <div v-if="saveSuccess" data-testid="save-success" class="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            {{ $t('profile.saved') }}
          </div>

          <button
            type="submit"
            data-testid="save-btn"
            :disabled="isSaving"
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ isSaving ? $t('common.saving') : $t('common.save') }}
          </button>
        </form>
      </div>

      <!-- Kedvenc csapat -->
      <div v-if="favStore.userLeagues.length > 0" class="bg-white rounded shadow p-6 space-y-4 mt-6">
        <h2 class="text-lg font-semibold text-gray-900">{{ $t('profile.favTitle') }}</h2>
        <p class="text-sm text-gray-500">{{ $t('profile.favDesc') }}</p>

        <div v-for="league in favStore.userLeagues" :key="league.id" class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-700 w-32 shrink-0">{{ league.shortName }}</span>

          <div v-if="isFavLocked(league.id)" class="flex items-center gap-2 text-sm text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
            <img
              v-if="getFavTeamFlagUrl(league.id)"
              :src="getFavTeamFlagUrl(league.id) ?? ''"
              :alt="getFavTeamName(league.id)"
              class="w-5 h-4 object-cover rounded-sm shrink-0"
            />
            <span>{{ getFavTeamName(league.id) || '—' }}</span>
          </div>

          <div v-else class="relative flex-1" :ref="(el) => setFavRootRef(league.id, el as HTMLElement | null)">
            <button
              type="button"
              :disabled="favSaveStatus[league.id] === 'saving'"
              :data-testid="`fav-select-${league.id}`"
              :aria-expanded="favOpen[league.id] === true"
              aria-haspopup="listbox"
              class="w-full flex items-center gap-2 border rounded px-3 py-1.5 text-sm bg-white text-left disabled:opacity-50 focus:ring-2 focus:ring-blue-300 outline-none"
              @click="toggleFavOpen(league.id)"
            >
              <img
                v-if="getFavTeamFlagUrl(league.id)"
                :src="getFavTeamFlagUrl(league.id) ?? ''"
                :alt="getFavTeamName(league.id)"
                class="w-5 h-4 object-cover rounded-sm shrink-0"
              />
              <span v-if="getFavTeamName(league.id)" class="flex-1 truncate text-gray-800">{{ getFavTeamName(league.id) }}</span>
              <span v-else class="flex-1 truncate text-gray-400">{{ $t('profile.favPlaceholder') }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 transition-transform shrink-0" :class="favOpen[league.id] ? 'rotate-180 text-blue-500' : 'text-gray-400'" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>

            <ul
              v-if="favOpen[league.id]"
              role="listbox"
              :data-testid="`fav-options-${league.id}`"
              class="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1"
            >
              <li
                v-for="team in favStore.leagueTeamsMap[league.id] ?? []"
                :key="team.id"
                role="option"
                :aria-selected="favStore.favoriteByLeagueId(league.id)?.teamId === team.id"
                :data-testid="`fav-option-${league.id}-${team.id}`"
                class="px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                :class="favStore.favoriteByLeagueId(league.id)?.teamId === team.id ? 'bg-blue-50' : ''"
                @click="selectFav(league.id, team.id)"
              >
                <img
                  v-if="team.flagUrl"
                  :src="team.flagUrl"
                  :alt="team.name"
                  class="w-5 h-4 object-cover rounded-sm shrink-0"
                />
                <span v-else class="w-5 h-4 shrink-0" aria-hidden="true"></span>
                <span class="flex-1 truncate">{{ team.name }}</span>
              </li>
            </ul>
          </div>

          <span v-if="favSaveStatus[league.id] === 'saved'" class="text-xs text-green-600" :data-testid="`fav-saved-${league.id}`">{{ $t('profile.favSaved') }}</span>
          <span v-else-if="favSaveStatus[league.id] === 'error'" class="text-xs text-red-500" :data-testid="`fav-error-${league.id}`">{{ $t('profile.favError') }}</span>
        </div>

        <div v-if="favError" class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {{ favError }}
        </div>
      </div>

      <div
        v-else-if="groupsLoaded"
        data-testid="fav-empty-state"
        class="bg-white rounded shadow p-6 space-y-2 mt-6"
      >
        <h2 class="text-lg font-semibold text-gray-900">{{ $t('profile.favTitle') }}</h2>
        <p class="text-sm text-gray-500">{{ $t('profile.favEmpty') }}</p>
      </div>

      <div class="bg-white rounded shadow p-6 space-y-3 mt-6">
        <h2 class="text-lg font-semibold text-gray-900">{{ $t('profile.pushTitle') }}</h2>
        <p class="text-sm text-gray-500">{{ $t('profile.pushDesc') }}</p>

        <p v-if="!pushSupported" data-testid="push-unsupported" class="text-xs text-amber-600">
          {{ $t('profile.pushUnsupported') }}
        </p>
        <p v-else-if="pushPermissionDenied" data-testid="push-perm-denied" class="text-xs text-amber-600">
          {{ $t('profile.pushPermissionDenied') }}
        </p>

        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            data-testid="push-enabled-toggle"
            :checked="pushEnabled"
            :disabled="pushSaving || !pushSupported"
            class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            @change="onPushToggle(($event.target as HTMLInputElement).checked)"
          />
          <span class="text-sm text-gray-800">{{ $t('profile.pushEnabledLabel') }}</span>
        </label>

        <p v-if="pushActiveCount > 0" class="text-xs text-gray-500" data-testid="push-active-count">
          {{ $t('profile.pushActiveCount', { count: pushActiveCount }) }}
        </p>
        <p v-else class="text-xs text-gray-500">{{ $t('profile.pushNoSubscriptions') }}</p>

        <p v-if="pushError" data-testid="push-error" class="text-xs text-red-600">{{ pushError }}</p>
        <p v-if="pushSaved" data-testid="push-saved" class="text-xs text-green-600">{{ $t('profile.pushSaved') }}</p>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth.store.js'
import { useLeagueFavoritesStore } from '../stores/league-favorites.store.js'
import { useGroupsStore } from '../stores/groups.store.js'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { api } from '../api/index.js'
import { isPushSupported, getPermissionState, ensureSubscribed, unsubscribeFromPush } from '../lib/push.js'

const { t } = useI18n()
const authStore = useAuthStore()
const favStore = useLeagueFavoritesStore()
const groupsStore = useGroupsStore()
const groupsLoaded = ref(false)

const pushEnabled = ref(false)
const pushActiveCount = ref(0)
const pushSaving = ref(false)
const pushError = ref<string | null>(null)
const pushSaved = ref(false)
const pushSupported = ref(true)
const pushPermissionDenied = ref(false)
let pushSavedTimer: ReturnType<typeof setTimeout> | null = null

const avatarSrc = computed((): string => {
  const user = authStore.user
  if (user?.avatarUrl) return user.avatarUrl
  return dicebearUrl(user?.displayName || user?.email || 'user')
})

const displayName = ref(authStore.user?.displayName ?? '')
const localeDraft = ref(authStore.user?.preferredLocale ?? 'hu')
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const saveSuccess = ref(false)
const favError = ref<string | null>(null)
const favSaveStatus = reactive<Record<string, 'saving' | 'saved' | 'error' | null>>({})
const favTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const favOpen = reactive<Record<string, boolean>>({})
const favRootRefs: Record<string, HTMLElement | null> = {}

function setFavRootRef(leagueId: string, el: HTMLElement | null): void {
  favRootRefs[leagueId] = el
}

function toggleFavOpen(leagueId: string): void {
  if (favSaveStatus[leagueId] === 'saving') return
  const next = !favOpen[leagueId]
  for (const k of Object.keys(favOpen)) favOpen[k] = false
  favOpen[leagueId] = next
}

function selectFav(leagueId: string, teamId: string): void {
  favOpen[leagueId] = false
  void onFavChange(leagueId, teamId)
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Node | null
  for (const leagueId of Object.keys(favOpen)) {
    if (!favOpen[leagueId]) continue
    const root = favRootRefs[leagueId]
    if (target && root && !root.contains(target)) favOpen[leagueId] = false
  }
}

function isFavLocked(leagueId: string): boolean {
  return favStore.favoriteByLeagueId(leagueId)?.isLocked ?? false
}

function getFavTeamName(leagueId: string): string {
  const fav = favStore.favoriteByLeagueId(leagueId)
  if (!fav) return ''
  const teams = favStore.leagueTeamsMap[leagueId] ?? []
  return teams.find(t => t.id === fav.teamId)?.name ?? ''
}

function getFavTeamFlagUrl(leagueId: string): string | null {
  const fav = favStore.favoriteByLeagueId(leagueId)
  if (!fav) return null
  const teams = favStore.leagueTeamsMap[leagueId] ?? []
  return teams.find(t => t.id === fav.teamId)?.flagUrl ?? null
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
    favError.value = e instanceof Error ? e.message : t('common.unknownError')
  }
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  displayName.value = authStore.user?.displayName ?? ''
  await Promise.all([
    favStore.fetchLeagues(),
    favStore.fetchFavorites(),
    groupsStore.fetchMyGroups(),
    loadPushStatus(),
  ])
  groupsLoaded.value = true
  await Promise.all(favStore.userLeagues.map(l => favStore.fetchLeagueTeams(l.id)))
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  if (pushSavedTimer) clearTimeout(pushSavedTimer)
})

async function loadPushStatus(): Promise<void> {
  pushSupported.value = isPushSupported()
  if (!pushSupported.value) return
  pushPermissionDenied.value = getPermissionState() === 'denied'
  try {
    const token = await authStore.getAccessToken()
    if (!token) return
    const status = await api.push.status(token)
    pushEnabled.value = status.pushEnabled
    pushActiveCount.value = status.activeSubscriptions
  } catch {
    // ignore — settings panel renders with defaults
  }
}

async function onPushToggle(next: boolean): Promise<void> {
  pushSaving.value = true
  pushError.value = null
  pushSaved.value = false
  try {
    const token = await authStore.getAccessToken()
    if (!token) throw new Error(t('common.unknownError'))

    if (next) {
      if (!isPushSupported()) {
        pushSupported.value = false
        throw new Error(t('profile.pushUnsupported'))
      }
      const sub = await ensureSubscribed(token)
      if (!sub) {
        pushPermissionDenied.value = getPermissionState() === 'denied'
        throw new Error(pushPermissionDenied.value ? t('profile.pushPermissionDenied') : t('profile.pushUnsupported'))
      }
    } else {
      await unsubscribeFromPush(token)
    }

    const result = await api.push.setEnabled(token, next)
    pushEnabled.value = result.pushEnabled
    const refreshed = await api.push.status(token)
    pushActiveCount.value = refreshed.activeSubscriptions
    pushSaved.value = true
    if (pushSavedTimer) clearTimeout(pushSavedTimer)
    pushSavedTimer = setTimeout(() => { pushSaved.value = false }, 3000)
  } catch (err) {
    pushError.value = err instanceof Error ? err.message : t('common.unknownError')
  } finally {
    pushSaving.value = false
  }
}

async function save(): Promise<void> {
  if (!displayName.value.trim()) return
  isSaving.value = true
  errorMessage.value = null
  saveSuccess.value = false
  try {
    await authStore.updateProfile({ displayName: displayName.value.trim(), preferredLocale: localeDraft.value })
    saveSuccess.value = true
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('common.unknownError')
  } finally {
    isSaving.value = false
  }
}
</script>
