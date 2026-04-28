import { computed, ref, onUnmounted, getCurrentInstance } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useGroupsStore } from '../stores/groups.store.js'

export interface PendingGroupSummary {
  readonly groupId: string
  readonly groupName: string
  readonly pendingCount: number
  readonly nearestDeadline: string | null
}

export interface UsePendingSpecialTipsReturn {
  readonly pendingGroups: ComputedRef<PendingGroupSummary[]>
  readonly totalPendingCount: ComputedRef<number>
  readonly now: Ref<number>
}

export function usePendingSpecialTips(): UsePendingSpecialTipsReturn {
  const groupsStore = useGroupsStore()
  const now = ref(Date.now())

  let intervalId: ReturnType<typeof setInterval> | null = null
  intervalId = setInterval(() => {
    now.value = Date.now()
  }, 60_000)

  if (getCurrentInstance()) {
    onUnmounted(() => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
    })
  }

  const pendingGroups = computed<PendingGroupSummary[]>(() => {
    const results: PendingGroupSummary[] = []

    for (const group of groupsStore.groups) {
      const predictions = groupsStore.specialPredictionsMap[group.id]
      if (predictions === undefined) continue

      let pendingCount = 0
      let nearestDeadline: string | null = null

      for (const sp of predictions) {
        if (sp.answer === null && new Date(sp.deadline).getTime() > now.value) {
          pendingCount++
          if (nearestDeadline === null || sp.deadline < nearestDeadline) {
            nearestDeadline = sp.deadline
          }
        }
      }

      if (pendingCount > 0) {
        results.push({
          groupId: group.id,
          groupName: group.name,
          pendingCount,
          nearestDeadline,
        })
      }
    }

    return results
  })

  const totalPendingCount = computed<number>(() =>
    pendingGroups.value.reduce((sum, g) => sum + g.pendingCount, 0)
  )

  return { pendingGroups, totalPendingCount, now }
}
