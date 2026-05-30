<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatRelativeDeadline } from '../lib/deadline.js'
import type { PendingGroupSummary } from '../composables/usePendingSpecialTips.js'

const props = defineProps<{
  pendingGroups: PendingGroupSummary[]
  totalPendingCount: number
  now: number
}>()

const router = useRouter()
const { t } = useI18n()

const globalNearestDeadline = computed<string | null>(() => {
  let nearest: string | null = null
  for (const g of props.pendingGroups) {
    if (g.nearestDeadline && (nearest === null || g.nearestDeadline < nearest)) {
      nearest = g.nearestDeadline
    }
  }
  return nearest
})

const deadlineInfo = computed(() => {
  if (!globalNearestDeadline.value) return null
  return formatRelativeDeadline(globalNearestDeadline.value, props.now, t)
})

function handleBannerClick(): void {
  router.push({ path: '/app/tournament-tips' })
}
</script>

<template>
  <div
    class="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer"
    data-testid="special-pending-banner"
    @click="handleBannerClick"
  >
    <div class="flex items-start gap-3">
      <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
      </svg>

      <div class="flex-1 min-w-0">
        <p class="font-semibold text-amber-900 text-sm">
          {{ $t('specialBanner.pending', { count: totalPendingCount }) }}
        </p>
        <p v-if="deadlineInfo" class="text-xs" :class="deadlineInfo.cssClass">
          {{ $t('specialBanner.nearestDeadline', { label: deadlineInfo.label }) }}
        </p>
      </div>

      <div class="flex items-center shrink-0">
        <span class="w-4 h-4 text-amber-500 text-lg leading-none">›</span>
      </div>
    </div>
  </div>
</template>
