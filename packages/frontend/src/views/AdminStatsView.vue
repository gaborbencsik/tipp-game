<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Statisztikák</h1>
    </div>
    <div class="flex gap-2 mb-6 flex-wrap">
      <router-link to="/admin/stats" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Statisztikák</router-link>
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/players" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Játékosok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
      <router-link to="/admin/global-types" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Speciális tippek</router-link>
      <router-link to="/admin/sync" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Szinkron</router-link>
    </div>

    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <div v-if="store.isLoading" data-testid="spinner" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <template v-else-if="store.summary">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2" data-testid="summary-cards">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold">{{ store.summary.userCount }}</div>
          <div class="text-sm text-gray-500">Regisztrált felhasználók</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold">{{ store.summary.activeUsers7d }}</div>
          <div class="text-sm text-gray-500">Aktív (7 nap)</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-2xl font-bold">{{ store.summary.predictionCount }}</div>
          <div class="text-sm text-gray-500">Összes tipp</div>
        </div>
        <div
          class="rounded-lg shadow p-4"
          :class="store.summary.fillRate < 50 ? 'bg-yellow-50' : 'bg-white'"
          data-testid="fill-rate-card"
        >
          <div class="text-2xl font-bold">{{ store.summary.fillRate }}%</div>
          <div class="text-sm text-gray-500">Kitöltési arány</div>
        </div>
      </div>
      <div class="text-sm text-gray-500 mb-6 text-center" data-testid="subtitle">
        {{ store.summary.groupCount }} csoport, átl. {{ store.summary.avgGroupSize }} fő
      </div>

      <!-- Users Table -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold">Felhasználók</h2>
          <input
            v-model="userSearch"
            type="text"
            placeholder="Keresés név alapján..."
            class="border border-gray-300 rounded px-3 py-1 text-sm w-56"
            data-testid="user-search"
          />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse" data-testid="users-table">
            <thead>
              <tr class="bg-gray-50 text-left">
                <th class="px-4 py-2 font-semibold">Felhasználó</th>
                <th class="px-4 py-2 font-semibold cursor-pointer select-none" @click="setUserSort('tipCount')">
                  Tippek {{ userSortIcon('tipCount') }}
                </th>
                <th class="px-4 py-2 font-semibold cursor-pointer select-none" @click="setUserSort('fillPercent')">
                  Kitöltés {{ userSortIcon('fillPercent') }}
                </th>
                <th class="px-4 py-2 font-semibold cursor-pointer select-none" @click="setUserSort('points')">
                  Pontok {{ userSortIcon('points') }}
                </th>
                <th class="px-4 py-2 font-semibold">Csoportok</th>
                <th class="px-4 py-2 font-semibold cursor-pointer select-none" @click="setUserSort('lastActivity')">
                  Utolsó aktivitás {{ userSortIcon('lastActivity') }}
                </th>
                <th class="px-4 py-2 font-semibold">Státusz</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in sortedUsers"
                :key="user.id"
                data-testid="user-row"
                :class="user.tipCount === 0 ? 'bg-red-50' : 'hover:bg-gray-50'"
                class="border-t"
              >
                <td class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <img
                      :src="dicebearUrl(user.displayName)"
                      :alt="user.displayName"
                      class="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <span>{{ user.displayName }}</span>
                  </div>
                </td>
                <td class="px-4 py-2">{{ user.tipCount }}</td>
                <td class="px-4 py-2">{{ user.fillPercent }}%</td>
                <td class="px-4 py-2">{{ user.points }}</td>
                <td class="px-4 py-2">{{ user.groupCount }}</td>
                <td class="px-4 py-2 text-gray-500">{{ formatActivity(user.lastActivity) }}</td>
                <td class="px-4 py-2">
                  <span
                    v-if="user.isBanned"
                    class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                  >Tiltott</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Matches Table -->
      <div>
        <h2 class="text-lg font-semibold mb-3">Meccsek</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse" data-testid="matches-table">
            <thead>
              <tr class="bg-gray-50 text-left">
                <th class="px-4 py-2 font-semibold cursor-pointer select-none" @click="setMatchSort('date')">
                  Meccs {{ matchSortIcon('date') }}
                </th>
                <th class="px-4 py-2 font-semibold">Tippelt</th>
                <th class="px-4 py-2 font-semibold cursor-pointer select-none" @click="setMatchSort('fillPercent')">
                  Kitöltés {{ matchSortIcon('fillPercent') }}
                </th>
                <th class="px-4 py-2 font-semibold">Eredmény</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="match in sortedMatches"
                :key="match.matchId"
                data-testid="match-row"
                class="border-t hover:bg-gray-50"
              >
                <td class="px-4 py-2">
                  {{ match.homeTeam }} – {{ match.awayTeam }}
                  <span class="text-gray-400 ml-1">{{ formatDate(match.date) }}</span>
                </td>
                <td class="px-4 py-2">{{ match.tippedCount }}/{{ match.totalUsers }}</td>
                <td class="px-4 py-2">{{ match.fillPercent }}%</td>
                <td class="px-4 py-2">{{ match.result ?? '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useAdminStatsStore } from '../stores/admin-stats.store.js'
import { dicebearUrl } from '../lib/avatar.js'
import { getDateLocale } from '../lib/dateLocale.js'
import type { AdminStatsUser, AdminStatsMatch } from '../types/index.js'

const store = useAdminStatsStore()

const userSearch = ref('')

type UserSortKey = 'tipCount' | 'fillPercent' | 'points' | 'lastActivity'
const userSortKey = ref<UserSortKey>('lastActivity')
const userSortAsc = ref(false)

type MatchSortKey = 'date' | 'fillPercent'
const matchSortKey = ref<MatchSortKey>('date')
const matchSortAsc = ref(false)

onMounted(() => {
  void store.fetchStats()
  void store.fetchMatches()
})

function setUserSort(key: UserSortKey): void {
  if (userSortKey.value === key) {
    userSortAsc.value = !userSortAsc.value
  } else {
    userSortKey.value = key
    userSortAsc.value = false
  }
}

function setMatchSort(key: MatchSortKey): void {
  if (matchSortKey.value === key) {
    matchSortAsc.value = !matchSortAsc.value
  } else {
    matchSortKey.value = key
    matchSortAsc.value = false
  }
}

function userSortIcon(key: UserSortKey): string {
  if (userSortKey.value !== key) return ''
  return userSortAsc.value ? '▲' : '▼'
}

function matchSortIcon(key: MatchSortKey): string {
  if (matchSortKey.value !== key) return ''
  return matchSortAsc.value ? '▲' : '▼'
}

const sortedUsers = computed((): AdminStatsUser[] => {
  let filtered = store.users
  if (userSearch.value.trim()) {
    const q = userSearch.value.toLowerCase()
    filtered = filtered.filter(u => u.displayName.toLowerCase().includes(q))
  }

  const sorted = [...filtered]
  const dir = userSortAsc.value ? 1 : -1

  sorted.sort((a, b) => {
    switch (userSortKey.value) {
      case 'tipCount':
        return (a.tipCount - b.tipCount) * dir
      case 'fillPercent':
        return (a.fillPercent - b.fillPercent) * dir
      case 'points':
        return (a.points - b.points) * dir
      case 'lastActivity': {
        const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        return (aTime - bTime) * dir
      }
    }
  })

  return sorted
})

const sortedMatches = computed((): AdminStatsMatch[] => {
  const sorted = [...store.matches]
  const dir = matchSortAsc.value ? 1 : -1

  sorted.sort((a, b) => {
    switch (matchSortKey.value) {
      case 'date':
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir
      case 'fillPercent':
        return (a.fillPercent - b.fillPercent) * dir
    }
  })

  return sorted
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' })
}

function formatActivity(iso: string | null): string {
  if (!iso) return 'Nincs'
  return new Date(iso).toLocaleDateString(getDateLocale())
}
</script>
