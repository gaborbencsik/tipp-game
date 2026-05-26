import { ref, computed, watch, type ComputedRef, type Ref } from 'vue'
import type { MatchDateGroup } from '../types/index.js'
import { getDateLocale } from '../lib/dateLocale.js'

export interface UseDayNavigationOptions {
  groups: ComputedRef<MatchDateGroup[]>
  storageKey: string
  defaultIndex: 'first' | 'last'
  defaultShowAll?: boolean
}

export interface UseDayNavigationReturn {
  readonly currentIndex: Ref<number | null>
  readonly currentGroup: ComputedRef<MatchDateGroup | null>
  readonly isShowingAll: ComputedRef<boolean>
  readonly canGoNext: ComputedRef<boolean>
  readonly canGoPrev: ComputedRef<boolean>
  readonly dateLabel: ComputedRef<string>
  goNext(): void
  goPrev(): void
  showAll(): void
  showSingleDay(): void
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: 'short',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

function getDefaultIndex(groups: MatchDateGroup[], defaultIndex: 'first' | 'last'): number {
  if (groups.length === 0) return 0
  return defaultIndex === 'last' ? groups.length - 1 : 0
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

export function useDayNavigation(options: UseDayNavigationOptions): UseDayNavigationReturn {
  const { groups, storageKey, defaultIndex, defaultShowAll = false } = options

  const currentIndex = ref<number | null>(readStoredMode())

  function readStoredMode(): number | null {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw === 'null') return null
      if (raw === null && defaultShowAll) return null
      return getDefaultIndex(groups.value, defaultIndex)
    } catch {
      return defaultShowAll ? null : getDefaultIndex(groups.value, defaultIndex)
    }
  }

  function writeStorage(): void {
    try {
      localStorage.setItem(storageKey, currentIndex.value === null ? 'null' : 'day')
    } catch {
      // ignore
    }
  }

  const isShowingAll = computed((): boolean => currentIndex.value === null)

  const currentGroup = computed((): MatchDateGroup | null => {
    if (currentIndex.value === null) return null
    return groups.value[currentIndex.value] ?? null
  })

  const canGoNext = computed((): boolean => {
    if (currentIndex.value === null) return false
    return currentIndex.value < groups.value.length - 1
  })

  const canGoPrev = computed((): boolean => {
    if (currentIndex.value === null) return false
    return currentIndex.value > 0
  })

  const dateLabel = computed((): string => {
    const group = currentGroup.value
    if (!group) return ''
    return formatShortDate(new Date(group.date + 'T00:00:00'))
  })

  function goNext(): void {
    if (currentIndex.value === null) return
    if (currentIndex.value < groups.value.length - 1) {
      currentIndex.value++
      writeStorage()
    }
  }

  function goPrev(): void {
    if (currentIndex.value === null) return
    if (currentIndex.value > 0) {
      currentIndex.value--
      writeStorage()
    }
  }

  function showAll(): void {
    currentIndex.value = null
    writeStorage()
  }

  function showSingleDay(): void {
    currentIndex.value = getDefaultIndex(groups.value, defaultIndex)
    writeStorage()
  }

  let initialized = groups.value.length > 0

  watch(() => groups.value.length, (newLen) => {
    if (newLen === 0) return
    if (!initialized) {
      initialized = true
      const stored = localStorage.getItem(storageKey)
      if (stored === 'null') {
        currentIndex.value = null
      } else if (stored === null && defaultShowAll) {
        currentIndex.value = null
      } else {
        currentIndex.value = getDefaultIndex(groups.value, defaultIndex)
      }
      return
    }
    if (currentIndex.value !== null && currentIndex.value >= newLen) {
      currentIndex.value = clampIndex(currentIndex.value, newLen)
    }
  })

  return {
    currentIndex,
    currentGroup,
    isShowingAll,
    canGoNext,
    canGoPrev,
    dateLabel,
    goNext,
    goPrev,
    showAll,
    showSingleDay,
  }
}
