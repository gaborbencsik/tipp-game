<template>
  <AppLayout>
    <div class="flex items-center gap-3 mb-6">
      <router-link to="/app/groups" class="text-blue-600 hover:text-blue-800 text-sm">← Csoportok</router-link>
      <h1 class="text-2xl font-bold text-gray-900">{{ groupName }}</h1>
    </div>

    <div data-testid="tab-bar" class="flex border-b border-gray-200 mb-6">
      <button
        data-testid="tab-leaderboard"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'leaderboard' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="activeTab = 'leaderboard'"
      >
        Ranglista
      </button>
      <button
        v-if="currentUserIsGroupAdmin"
        data-testid="tab-members"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'members' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="activeTab = 'members'"
      >
        Tagok
      </button>
      <button
        v-if="canManageSettings"
        data-testid="tab-settings"
        class="px-4 py-2 text-sm font-medium"
        :class="activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-gray-500'"
        @click="activeTab = 'settings'"
      >
        Beállítások
      </button>
    </div>

    <!-- Ranglista tab -->
    <div v-if="activeTab === 'leaderboard'">
      <div v-if="isLoading" class="text-gray-500">Betöltés...</div>
      <div v-else-if="error" class="text-red-600">{{ error }}</div>
      <div v-else-if="entries.length === 0" class="text-gray-500">Még nincs ranglista adat.</div>
      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm table-fixed">
          <colgroup>
            <col class="w-12" />
            <col />
            <col class="w-16" />
            <col class="w-16" />
            <col class="w-16" />
          </colgroup>
          <thead>
            <tr class="border-b border-gray-200 text-gray-500 text-left">
              <th class="px-4 py-3">#</th>
              <th class="px-4 py-3">Játékos</th>
              <th class="px-4 py-3 text-right">Tipp</th>
              <th class="px-4 py-3 text-right">Helyes</th>
              <th class="px-4 py-3 text-right font-semibold">Pont</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in entries"
              :key="entry.userId"
              class="border-b border-gray-100 last:border-0 transition-colors"
              :class="entry.userId === authStore.user?.id ? 'bg-blue-50' : 'hover:bg-gray-50'"
            >
              <td class="px-4 py-3 text-gray-400 font-medium">{{ entry.rank }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2 min-w-0">
                  <img
                    :src="entry.avatarUrl ?? dicebearUrl(entry.displayName)"
                    :alt="entry.displayName"
                    class="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <span class="font-medium text-gray-800 truncate">{{ entry.displayName }}</span>
                  <span v-if="entry.userId === authStore.user?.id" class="text-xs text-blue-600 shrink-0">(te)</span>
                </div>
              </td>
              <td class="px-4 py-3 text-right text-gray-600">{{ entry.predictionCount }}</td>
              <td class="px-4 py-3 text-right text-gray-600">{{ entry.correctCount }}</td>
              <td class="px-4 py-3 text-right font-bold text-blue-700">{{ entry.totalPoints }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tagok tab -->
    <div v-else-if="activeTab === 'members'" data-testid="members-tab">
      <div v-if="groupsStore.membersLoading" data-testid="members-spinner" class="text-gray-500">Betöltés...</div>
      <div v-else-if="groupsStore.membersError" class="text-red-600">{{ groupsStore.membersError }}</div>
      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-gray-500 text-left">
              <th class="px-4 py-3">Tag</th>
              <th class="px-4 py-3">Szerep</th>
              <th class="px-4 py-3">Csatlakozott</th>
              <th v-if="currentUserIsGroupAdmin" class="px-4 py-3">Műveletek</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in members"
              :key="member.id"
              data-testid="member-row"
              class="border-b border-gray-100 last:border-0"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <img
                    :src="member.avatarUrl ?? dicebearUrl(member.displayName)"
                    :alt="member.displayName"
                    class="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <span class="font-medium text-gray-800">{{ member.displayName }}</span>
                  <span v-if="member.userId === authStore.user?.id" class="text-xs text-blue-600">(te)</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="member.isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'"
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ member.isAdmin ? 'Admin' : 'Tag' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-sm">{{ formatDate(member.joinedAt) }}</td>
              <td v-if="currentUserIsGroupAdmin" class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    :disabled="member.userId === authStore.user?.id"
                    class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="onToggleAdmin(member)"
                  >
                    {{ member.isAdmin ? 'Admin visszavon' : 'Admin' }}
                  </button>
                  <button
                    :disabled="member.userId === authStore.user?.id"
                    class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="confirmRemoveUserId = member.userId"
                  >
                    Eltávolít
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Invite section (admin only, inside members tab) -->
    <div v-if="activeTab === 'members' && currentUserIsGroupAdmin" data-testid="invite-section" class="mt-6 bg-white rounded-xl border border-gray-200 p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Meghívó kód</h3>
      <div class="flex items-center gap-2 mb-3">
        <span data-testid="invite-code-display" class="font-mono text-lg font-bold tracking-widest text-gray-900">{{ currentGroup?.inviteCode }}</span>
        <button
          class="text-xs px-2 py-1 rounded border transition-all duration-200"
          :class="copiedInvite === 'code' ? 'border-green-400 bg-green-50 text-green-600' : 'border-gray-300 text-gray-600 hover:border-gray-400'"
          @click="copyInviteCode"
        >
          {{ copiedInvite === 'code' ? '✓ Másolva' : 'Kód' }}
        </button>
        <button
          class="text-xs px-2 py-1 rounded border transition-all duration-200"
          :class="copiedInvite === 'url' ? 'border-green-400 bg-green-50 text-green-600' : 'border-blue-300 text-blue-600 hover:border-blue-400'"
          @click="copyInviteUrl"
        >
          {{ copiedInvite === 'url' ? '✓ Másolva' : 'Link másolása' }}
        </button>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">
          Állapot: <span :class="currentGroup?.inviteActive ? 'text-green-600' : 'text-red-500'">{{ currentGroup?.inviteActive ? 'Aktív' : 'Inaktív' }}</span>
        </span>
        <button
          data-testid="invite-toggle-btn"
          class="text-xs px-2 py-1 rounded border"
          :class="currentGroup?.inviteActive ? 'border-red-300 text-red-600' : 'border-green-300 text-green-600'"
          @click="onToggleInvite"
        >
          {{ currentGroup?.inviteActive ? 'Deaktiválás' : 'Aktiválás' }}
        </button>
        <button
          data-testid="invite-regenerate-btn"
          class="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600"
          @click="showInviteConfirm = true"
        >
          Újragenerálás
        </button>
      </div>
    </div>

    <!-- Csoport törlése (admin only) -->
    <div v-if="activeTab === 'members' && currentUserIsGroupAdmin" class="mt-4">
      <button
        data-testid="delete-group-btn"
        class="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        @click="showDeleteConfirm = true"
      >
        Csoport törlése
      </button>
    </div>

    <!-- Beállítások tab -->
    <div v-if="activeTab === 'settings'" data-testid="settings-tab">
      <div v-if="groupsStore.groupScoringLoading" class="text-gray-500">Betöltés...</div>
      <div v-else-if="groupsStore.groupScoringError" class="text-red-600">{{ groupsStore.groupScoringError }}</div>
      <div v-else class="max-w-md">
        <h3 class="text-base font-semibold text-gray-800 mb-1">Egyedi pontrendszer</h3>
        <p class="text-sm text-gray-500 mb-4">Ha beállítod, a csoport ranglista ezt a pontrendszert használja a globális helyett.</p>
        <form class="space-y-3" @submit.prevent="submitScoringConfig">
          <div v-for="field in scoringFields" :key="field.key" class="flex items-center justify-between gap-4">
            <label class="text-sm font-medium text-gray-700">{{ field.label }}</label>
            <input
              v-model.number="scoringDraft[field.key]"
              :data-testid="`settings-field-${field.key}`"
              type="number"
              min="0"
              max="10"
              required
              class="w-20 border rounded px-2 py-1 text-center"
            />
          </div>
          <div class="flex items-center gap-4 pt-2">
            <button
              type="submit"
              data-testid="settings-submit"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              :disabled="groupsStore.groupScoringSaveStatus === 'saving'"
            >
              Mentés
            </button>
            <span
              v-if="groupsStore.groupScoringSaveStatus === 'saved'"
              data-testid="settings-save-status"
              class="text-sm text-green-600"
            >
              Elmentve!
            </span>
            <span
              v-else-if="groupsStore.groupScoringSaveStatus === 'error'"
              data-testid="settings-save-status"
              class="text-sm text-red-600"
            >
              Hiba a mentés során
            </span>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirm dialog -->    <div v-if="confirmRemoveUserId !== null" data-testid="confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">Biztosan el szeretnéd távolítani ezt a tagot?</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="confirmRemoveUserId = null"
          >
            Mégse
          </button>
          <button
            data-testid="confirm-ok"
            class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium"
            @click="onConfirmRemove"
          >
            Eltávolítás
          </button>
        </div>
      </div>
    </div>

    <!-- Invite confirm dialog -->
    <div v-if="showInviteConfirm" data-testid="invite-confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-4">Biztosan újra szeretnéd generálni a meghívó kódot? A régi kód érvénytelenné válik.</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="invite-confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="showInviteConfirm = false"
          >
            Mégse
          </button>
          <button
            data-testid="invite-confirm-ok"
            class="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium"
            @click="onConfirmRegenerate"
          >
            Újragenerálás
          </button>
        </div>
      </div>
    </div>

    <!-- Delete group confirm dialog -->
    <div v-if="showDeleteConfirm" data-testid="delete-confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
        <p class="text-gray-800 mb-1 font-semibold">Csoport törlése</p>
        <p class="text-gray-500 text-sm mb-4">A csoport és a csoport ranglista véglegesen törlődik. Ez a művelet nem vonható vissza.</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="delete-confirm-cancel"
            class="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700"
            @click="showDeleteConfirm = false"
          >
            Mégse
          </button>
          <button
            data-testid="delete-confirm-ok"
            class="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium"
            @click="onConfirmDelete"
          >
            Törlés
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { GroupMember, LeaderboardEntry, ScoringConfigInput } from '../types/index.js'

type Tab = 'leaderboard' | 'members' | 'settings'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
}

const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const groupId = route.params.id as string
const entries = ref<LeaderboardEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<Tab>('leaderboard')
const confirmRemoveUserId = ref<string | null>(null)

const groupName = computed(() => groupsStore.groups.find(g => g.id === groupId)?.name ?? 'Csoport')
const currentGroup = computed(() => groupsStore.groups.find(g => g.id === groupId))
const members = computed(() => groupsStore.membersMap[groupId] ?? [])
const currentUserIsGroupAdmin = computed(() =>
  groupsStore.membersMap[groupId]?.some(m => m.userId === authStore.user?.id && m.isAdmin) ?? false,
)
const isGlobalAdmin = computed(() => authStore.user?.role === 'admin')
const canManageSettings = computed(() => currentUserIsGroupAdmin.value || isGlobalAdmin.value)

const showInviteConfirm = ref(false)
const showDeleteConfirm = ref(false)
const copiedInvite = ref<'code' | 'url' | null>(null)

const scoringFields: Array<{ key: keyof ScoringConfigInput; label: string }> = [
  { key: 'exactScore', label: 'Pontos találat' },
  { key: 'correctWinnerAndDiff', label: 'Helyes győztes + gólkülönbség' },
  { key: 'correctWinner', label: 'Helyes győztes' },
  { key: 'correctDraw', label: 'Döntetlen tipp döntetlenre' },
  { key: 'correctOutcome', label: 'Outcome bónusz (hossz./tizenegyes)' },
  { key: 'incorrect', label: 'Helytelen tipp' },
]

type ScoringDraft = {
  exactScore: number
  correctWinnerAndDiff: number
  correctWinner: number
  correctDraw: number
  correctOutcome: number
  incorrect: number
}

const scoringDraft = reactive<ScoringDraft>({
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
})

watch(
  () => groupsStore.groupScoringConfigs[groupId],
  (cfg) => {
    if (!cfg) return
    scoringDraft.exactScore = cfg.exactScore
    scoringDraft.correctWinnerAndDiff = cfg.correctWinnerAndDiff
    scoringDraft.correctWinner = cfg.correctWinner
    scoringDraft.correctDraw = cfg.correctDraw
    scoringDraft.correctOutcome = cfg.correctOutcome
    scoringDraft.incorrect = cfg.incorrect
  },
  { immediate: true },
)

async function submitScoringConfig(): Promise<void> {
  await groupsStore.setGroupScoringConfig(groupId, { ...scoringDraft })
}

function setCopiedInvite(type: 'code' | 'url'): void {
  copiedInvite.value = type
  setTimeout(() => { copiedInvite.value = null }, 2000)
}

async function onToggleAdmin(member: GroupMember): Promise<void> {
  await groupsStore.toggleMemberAdmin(groupId, member.userId, !member.isAdmin)
}

async function onConfirmRemove(): Promise<void> {
  if (!confirmRemoveUserId.value) return
  const userId = confirmRemoveUserId.value
  confirmRemoveUserId.value = null
  await groupsStore.removeMember(groupId, userId)
}

async function onToggleInvite(): Promise<void> {
  const active = currentGroup.value?.inviteActive
  if (active === undefined) return
  await groupsStore.setInviteActive(groupId, !active)
}

async function onConfirmRegenerate(): Promise<void> {
  showInviteConfirm.value = false
  await groupsStore.regenerateInvite(groupId)
}

async function onConfirmDelete(): Promise<void> {
  showDeleteConfirm.value = false
  await groupsStore.deleteGroup(groupId)
  await router.push('/app/groups')
}

function copyInviteCode(): void {
  const code = currentGroup.value?.inviteCode
  if (code) {
    navigator.clipboard.writeText(code)
    setCopiedInvite('code')
  }
}

function copyInviteUrl(): void {
  const code = currentGroup.value?.inviteCode
  if (code) {
    navigator.clipboard.writeText(`${window.location.origin}/app/join/${code}`)
    setCopiedInvite('url')
  }
}

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    if (groupsStore.groups.length === 0) await groupsStore.fetchMyGroups()
    const token = await getAccessToken()
    entries.value = await api.groups.leaderboard(token, groupId)
    await groupsStore.fetchGroupMembers(groupId)
    if (canManageSettings.value) {
      await groupsStore.fetchGroupScoringConfig(groupId)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isLoading.value = false
  }
})
</script>
