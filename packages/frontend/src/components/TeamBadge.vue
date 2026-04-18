<template>
  <span class="inline-flex items-center gap-1.5">
    <span
      v-if="showFlag"
      :class="`fi fi-${team.countryCode}`"
      class="shrink-0"
      style="width:1.2em;height:0.9em"
    />
    <img
      v-else-if="team.flagUrl && !imgFailed"
      :src="team.flagUrl"
      :alt="team.shortCode"
      class="w-5 h-4 object-contain shrink-0"
      @error="imgFailed = true"
    />
    <span>{{ team.name }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MatchTeam } from '../types/index.js'

const props = defineProps<{
  team: Pick<MatchTeam, 'name' | 'shortCode' | 'teamType' | 'countryCode' | 'flagUrl'>
}>()

const imgFailed = ref(false)
const showFlag = computed(() => props.team.teamType === 'national' && !!props.team.countryCode)
</script>
