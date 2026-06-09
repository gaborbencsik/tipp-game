<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Felhasználók kezelése</h1>
    </div>
    <AdminNav />

    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <div v-if="store.isLoading" data-testid="spinner" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="bg-gray-50 text-left">
            <th class="px-4 py-2 font-semibold">Email</th>
            <th class="px-4 py-2 font-semibold">Felhasználó</th>
            <th class="px-4 py-2 font-semibold">Szerepkör</th>
            <th class="px-4 py-2 font-semibold">Státusz</th>
            <th class="px-4 py-2 font-semibold">Regisztrálva</th>
            <th class="px-4 py-2 font-semibold">Műveletek</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in store.users"
            :key="user.id"
            data-testid="user-row"
            class="border-t hover:bg-gray-50"
          >
            <td class="px-4 py-2">{{ user.email }}</td>
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <img
                  :src="dicebearUrl(user.displayName)"
                  :alt="user.displayName"
                  class="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <span>{{ user.displayName }}</span>
                <span
                  v-if="user.isSupporter"
                  data-testid="supporter-badge"
                  :data-tooltip="$t('users.supporterBadgeTooltip')"
                  class="tt supporter-badge-anim inline-flex items-center justify-center bg-amber-50 ring-1 ring-amber-200 rounded-full w-6 h-6 text-sm leading-none"
                >🍺</span>
              </div>
            </td>
            <td class="px-4 py-2">
              <select
                data-testid="role-select"
                :value="user.role"
                :disabled="user.id === authStore.user?.id"
                class="text-xs border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                @change="onRoleChange(user, ($event.target as HTMLSelectElement).value as 'user' | 'admin')"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </td>
            <td class="px-4 py-2">
              <span
                :class="user.bannedAt ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
                class="px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ user.bannedAt ? 'Tiltott' : 'Aktív' }}
              </span>
            </td>
            <td class="px-4 py-2 text-gray-500">{{ formatDate(user.createdAt) }}</td>
            <td class="px-4 py-2 flex gap-2">
              <button
                data-testid="ban-btn"
                :disabled="user.id === authStore.user?.id"
                :class="user.bannedAt ? 'border-green-500 text-green-700 hover:bg-green-50' : 'border-red-400 text-red-600 hover:bg-red-50'"
                class="px-3 py-1 text-xs rounded border disabled:opacity-40 disabled:cursor-not-allowed"
                @click="toggleBan(user)"
              >
                {{ user.bannedAt ? 'Feloldás' : 'Tiltás' }}
              </button>
              <button
                data-testid="supporter-btn"
                :class="user.isSupporter ? 'border-amber-500 text-amber-700 hover:bg-amber-50' : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                class="px-3 py-1 text-xs rounded border"
                :title="user.isSupporter ? $t('admin.users.supporterToggleOff') : $t('admin.users.supporterToggleOn')"
                @click="toggleSupporter(user)"
              >
                {{ user.isSupporter ? '★ ' + $t('admin.users.supporterToggleOff') : '☆ ' + $t('admin.users.supporterToggleOn') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import AdminNav from '../components/admin/AdminNav.vue'
import { useAdminUsersStore } from '../stores/admin-users.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { dicebearUrl } from '../lib/avatar.js'
import type { AdminUser } from '../types/index.js'
import { getDateLocale } from '../lib/dateLocale.js'

const store = useAdminUsersStore()
const authStore = useAuthStore()

onMounted(() => { void store.fetchUsers() })

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(getDateLocale())
}

async function onRoleChange(user: AdminUser, newRole: 'user' | 'admin'): Promise<void> {
  await store.updateUserRole(user.id, newRole)
}

async function toggleBan(user: AdminUser): Promise<void> {
  await store.banUser(user.id, !user.bannedAt)
}

async function toggleSupporter(user: AdminUser): Promise<void> {
  await store.setSupporter(user.id, !user.isSupporter)
}
</script>
