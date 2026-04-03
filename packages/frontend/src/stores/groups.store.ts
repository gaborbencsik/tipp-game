import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { Group, GroupInput, JoinGroupInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMyGroups(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      groups.value = await api.groups.mine(token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function createGroup(input: GroupInput): Promise<Group> {
    const token = await getAccessToken()
    const group = await api.groups.create(token, input)
    groups.value = [...groups.value, group]
    return group
  }

  async function joinGroup(input: JoinGroupInput): Promise<Group> {
    const token = await getAccessToken()
    const group = await api.groups.join(token, input)
    groups.value = [...groups.value, group]
    return group
  }

  return {
    groups,
    isLoading,
    error,
    fetchMyGroups,
    createGroup,
    joinGroup,
  }
})
