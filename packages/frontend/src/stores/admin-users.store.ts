import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { AdminUser } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminUsersStore = defineStore('admin-users', () => {
  const users = ref<AdminUser[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUsers(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      users.value = await api.admin.users.list(token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function updateUserRole(id: string, role: 'user' | 'admin'): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.users.updateRole(token, id, role)
      users.value = users.value.map(u => (u.id === id ? updated : u))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  async function banUser(id: string, ban: boolean): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.users.ban(token, id, ban)
      users.value = users.value.map(u => (u.id === id ? updated : u))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  return { users, isLoading, error, fetchUsers, updateUserRole, banUser }
})
