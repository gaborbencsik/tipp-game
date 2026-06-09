<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    size?: Size
    responsive?: boolean
    testid?: string
  }>(),
  { size: 'sm', responsive: false },
)

const { t } = useI18n()

const sizeClass = computed(() => {
  if (props.responsive) {
    return 'w-5 h-5 text-xs md:w-6 md:h-6 md:text-sm'
  }
  switch (props.size) {
    case 'xs': return 'w-5 h-5 text-xs'
    case 'md': return 'w-7 h-7 text-base'
    case 'lg': return 'w-8 h-8 text-lg'
    default: return 'w-6 h-6 text-sm'
  }
})
</script>

<template>
  <span
    :data-tooltip="t('users.supporterBadgeTooltip')"
    :data-testid="testid"
    aria-label="Supporter"
    class="tt supporter-badge-anim shrink-0 inline-flex items-center justify-center rounded-full leading-none bg-emerald-200 ring-1 ring-emerald-300 shadow-sm shadow-emerald-400/15"
    :class="sizeClass"
  >🍺</span>
</template>
