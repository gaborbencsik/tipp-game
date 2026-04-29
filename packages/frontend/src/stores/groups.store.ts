import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { Group, GroupInput, GroupMember, JoinGroupInput, ScoringConfigFull, ScoringConfigInput, SpecialPredictionType, SpecialTypeInput, SpecialPredictionWithType, SpecialPredictionInput, GlobalTypeWithSubscription } from '../types/index.js'

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
  const groupScoringConfigs = ref<Record<string, ScoringConfigFull | null>>({})
  const groupScoringLoading = ref(false)
  const groupScoringError = ref<string | null>(null)
  const groupScoringSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Special prediction types (admin)
  const specialTypesMap = ref<Record<string, SpecialPredictionType[]>>({})
  const specialTypesLoading = ref(false)
  const specialTypesError = ref<string | null>(null)

  // Special predictions (member)
  const specialPredictionsMap = ref<Record<string, SpecialPredictionWithType[]>>({})
  const specialPredictionsLoading = ref(false)
  const specialPredictionsError = ref<string | null>(null)

  // Global type subscriptions (admin)
  const globalSubscriptionsMap = ref<Record<string, GlobalTypeWithSubscription[]>>({})
  const globalSubscriptionsLoading = ref(false)
  const globalSubscriptionsError = ref<string | null>(null)

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

  async function updateGroupSettings(groupId: string, settings: { favoriteTeamDoublePoints: boolean }): Promise<void> {
    const token = await getAccessToken()
    const updated = await api.groups.updateSettings(token, groupId, settings)
    groups.value = groups.value.map((g) => g.id === groupId ? updated : g)
  }

  async function deleteGroup(groupId: string): Promise<void> {
    const token = await getAccessToken()
    await api.groups.delete(token, groupId)
    groups.value = groups.value.filter((g) => g.id !== groupId)
  }

  async function fetchGroupScoringConfig(groupId: string): Promise<void> {
    groupScoringLoading.value = true
    groupScoringError.value = null
    try {
      const token = await getAccessToken()
      groupScoringConfigs.value[groupId] = await api.groups.getScoringConfig(token, groupId)
    } catch (err) {
      groupScoringError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      groupScoringLoading.value = false
    }
  }

  async function setGroupScoringConfig(groupId: string, input: ScoringConfigInput): Promise<void> {
    groupScoringSaveStatus.value = 'saving'
    try {
      const token = await getAccessToken()
      const updated = await api.groups.setScoringConfig(token, groupId, input)
      groupScoringConfigs.value[groupId] = updated
      groupScoringSaveStatus.value = 'saved'
      setTimeout(() => { groupScoringSaveStatus.value = 'idle' }, 3000)
    } catch {
      groupScoringSaveStatus.value = 'error'
    }
  }

  // ─── Special prediction types (admin) ────────────────────────────────────────

  async function fetchSpecialTypes(groupId: string): Promise<void> {
    specialTypesLoading.value = true
    specialTypesError.value = null
    try {
      const token = await getAccessToken()
      specialTypesMap.value[groupId] = await api.groups.specialTypes.list(token, groupId)
    } catch (err) {
      specialTypesError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      specialTypesLoading.value = false
    }
  }

  async function createSpecialType(groupId: string, input: SpecialTypeInput): Promise<SpecialPredictionType> {
    const token = await getAccessToken()
    const created = await api.groups.specialTypes.create(token, groupId, input)
    specialTypesMap.value[groupId] = [...(specialTypesMap.value[groupId] ?? []), created]
    return created
  }

  async function updateSpecialType(groupId: string, typeId: string, input: SpecialTypeInput): Promise<SpecialPredictionType> {
    const token = await getAccessToken()
    const updated = await api.groups.specialTypes.update(token, groupId, typeId, input)
    specialTypesMap.value[groupId] = (specialTypesMap.value[groupId] ?? []).map(t => t.id === typeId ? updated : t)
    return updated
  }

  async function deactivateSpecialType(groupId: string, typeId: string): Promise<void> {
    const token = await getAccessToken()
    await api.groups.specialTypes.deactivate(token, groupId, typeId)
    specialTypesMap.value[groupId] = (specialTypesMap.value[groupId] ?? []).filter(t => t.id !== typeId)
  }

  async function setSpecialTypeAnswer(groupId: string, typeId: string, correctAnswer: string): Promise<void> {
    const token = await getAccessToken()
    const updated = await api.groups.specialTypes.setAnswer(token, groupId, typeId, correctAnswer)
    specialTypesMap.value[groupId] = (specialTypesMap.value[groupId] ?? []).map(t => t.id === typeId ? updated : t)
  }

  // ─── Special predictions (member) ────────────────────────────────────────────

  async function fetchSpecialPredictions(groupId: string): Promise<void> {
    specialPredictionsLoading.value = true
    specialPredictionsError.value = null
    try {
      const token = await getAccessToken()
      specialPredictionsMap.value[groupId] = await api.groups.specialPredictions.list(token, groupId)
    } catch (err) {
      specialPredictionsError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      specialPredictionsLoading.value = false
    }
  }

  async function upsertSpecialPrediction(groupId: string, input: SpecialPredictionInput): Promise<void> {
    const token = await getAccessToken()
    const updated = await api.groups.specialPredictions.upsert(token, groupId, input)
    specialPredictionsMap.value[groupId] = (specialPredictionsMap.value[groupId] ?? []).map(p =>
      p.typeId === input.typeId ? updated : p,
    )
  }

  // ─── Global type subscriptions (admin) ──────────────────────────────────────

  async function fetchGlobalSubscriptions(groupId: string): Promise<void> {
    globalSubscriptionsLoading.value = true
    globalSubscriptionsError.value = null
    try {
      const token = await getAccessToken()
      globalSubscriptionsMap.value[groupId] = await api.groups.globalTypeSubscriptions.list(token, groupId)
    } catch (err) {
      globalSubscriptionsError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      globalSubscriptionsLoading.value = false
    }
  }

  async function subscribeGlobalType(groupId: string, typeId: string): Promise<void> {
    const token = await getAccessToken()
    await api.groups.globalTypeSubscriptions.subscribe(token, groupId, typeId)
    globalSubscriptionsMap.value[groupId] = (globalSubscriptionsMap.value[groupId] ?? []).map(t =>
      t.id === typeId ? { ...t, subscribed: true } : t,
    )
    delete specialPredictionsMap.value[groupId]
  }

  async function unsubscribeGlobalType(groupId: string, typeId: string): Promise<void> {
    const token = await getAccessToken()
    await api.groups.globalTypeSubscriptions.unsubscribe(token, groupId, typeId)
    globalSubscriptionsMap.value[groupId] = (globalSubscriptionsMap.value[groupId] ?? []).map(t =>
      t.id === typeId ? { ...t, subscribed: false } : t,
    )
    delete specialPredictionsMap.value[groupId]
  }

  return {
    groups,
    isLoading,
    error,
    membersMap,
    membersLoading,
    membersError,
    groupScoringConfigs,
    groupScoringLoading,
    groupScoringError,
    groupScoringSaveStatus,
    specialTypesMap,
    specialTypesLoading,
    specialTypesError,
    specialPredictionsMap,
    specialPredictionsLoading,
    specialPredictionsError,
    globalSubscriptionsMap,
    globalSubscriptionsLoading,
    globalSubscriptionsError,
    fetchMyGroups,
    createGroup,
    joinGroup,
    fetchGroupMembers,
    removeMember,
    toggleMemberAdmin,
    regenerateInvite,
    setInviteActive,
    updateGroupSettings,
    deleteGroup,
    fetchGroupScoringConfig,
    setGroupScoringConfig,
    fetchSpecialTypes,
    createSpecialType,
    updateSpecialType,
    deactivateSpecialType,
    setSpecialTypeAnswer,
    fetchSpecialPredictions,
    upsertSpecialPrediction,
    fetchGlobalSubscriptions,
    subscribeGlobalType,
    unsubscribeGlobalType,
  }
})
