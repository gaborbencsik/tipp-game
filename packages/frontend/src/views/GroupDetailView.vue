<template>
  <AppLayout>
    <div class="flex items-center gap-3 mb-6">
      <router-link to="/groups" class="text-blue-600 hover:text-blue-800 text-sm">← Csoportok</router-link>
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

    <!-- Confirm dialog -->
    <div v-if="confirmRemoveUserId !== null" data-testid="confirm-dialog" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { GroupMember, LeaderboardEntry } from '../types/index.js'

type Tab = 'leaderboard' | 'members'

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
const groupsStore = useGroupsStore()
const authStore = useAuthStore()

const groupId = route.params.id as string
const entries = ref<LeaderboardEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<Tab>('leaderboard')
const confirmRemoveUserId = ref<string | null>(null)

const groupName = computed(() => groupsStore.groups.find(g => g.id === groupId)?.name ?? 'Csoport')
const members = computed(() => groupsStore.membersMap[groupId] ?? [])
const currentUserIsGroupAdmin = computed(() =>
  groupsStore.membersMap[groupId]?.some(m => m.userId === authStore.user?.id && m.isAdmin) ?? false,
)

async function onToggleAdmin(member: GroupMember): Promise<void> {
  await groupsStore.toggleMemberAdmin(groupId, member.userId, !member.isAdmin)
}

async function onConfirmRemove(): Promise<void> {
  if (!confirmRemoveUserId.value) return
  const userId = confirmRemoveUserId.value
  confirmRemoveUserId.value = null
  await groupsStore.removeMember(groupId, userId)
}

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    if (groupsStore.groups.length === 0) await groupsStore.fetchMyGroups()
    const token = await getAccessToken()
    entries.value = await api.groups.leaderboard(token, groupId)
    await groupsStore.fetchGroupMembers(groupId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isLoading.value = false
  }
})
</script>
