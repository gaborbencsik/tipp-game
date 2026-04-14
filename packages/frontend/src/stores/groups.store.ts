import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { Group, GroupInput, GroupMember, JoinGroupInput } from '../types/index.js'

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
  const membersMap = ref<Record<string, GroupMember[]>>({})
  const membersLoading = ref(false)
  const membersError = ref<string | null>(null)

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

  async function fetchGroupMembers(groupId: string): Promise<void> {
    membersLoading.value = true
    membersError.value = null
    try {
      const token = await getAccessToken()
      membersMap.value[groupId] = await api.groups.members(token, groupId)
    } catch (err) {
      membersError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      membersLoading.value = false
    }
  }

  async function removeMember(groupId: string, userId: string): Promise<void> {
    const token = await getAccessToken()
    await api.groups.removeMember(token, groupId, userId)
    membersMap.value[groupId] = (membersMap.value[groupId] ?? []).filter((m) => m.userId !== userId)
  }

  async function toggleMemberAdmin(groupId: string, userId: string, isAdmin: boolean): Promise<void> {
    const token = await getAccessToken()
    const updated = await api.groups.updateMemberRole(token, groupId, userId, isAdmin)
    membersMap.value[groupId] = (membersMap.value[groupId] ?? []).map((m) =>
      m.userId === userId ? updated : m,
    )
  }

  async function regenerateInvite(groupId: string): Promise<void> {
    const token = await getAccessToken()
    const updated = await api.groups.regenerateInvite(token, groupId)
    groups.value = groups.value.map((g) => g.id === groupId ? updated : g)
  }

  async function setInviteActive(groupId: string, active: boolean): Promise<void> {
    const token = await getAccessToken()
    const updated = await api.groups.setInviteActive(token, groupId, active)
    groups.value = groups.value.map((g) => g.id === groupId ? updated : g)
  }

  return {
    groups,
    isLoading,
    error,
    membersMap,
    membersLoading,
    membersError,
    fetchMyGroups,
    createGroup,
    joinGroup,
    fetchGroupMembers,
    removeMember,
    toggleMemberAdmin,
    regenerateInvite,
    setInviteActive,
  }
})
