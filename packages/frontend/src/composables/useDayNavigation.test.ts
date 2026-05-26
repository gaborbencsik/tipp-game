import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import { useDayNavigation } from './useDayNavigation.js'
import type { MatchDateGroup } from '../types/index.js'

function makeGroups(dates: string[]): MatchDateGroup[] {
  return dates.map(date => ({
    date,
    label: date,
    matches: [{ id: `m-${date}`, status: 'finished' }] as unknown as MatchDateGroup['matches'],
  }))
}

describe('useDayNavigation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to last index when defaultIndex is "last"', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test-finished', defaultIndex: 'last' })

    expect(nav.currentIndex.value).toBe(2)
    expect(nav.isShowingAll.value).toBe(false)
  })

  it('defaults to first index when defaultIndex is "first"', () => {
    const groups = computed(() => makeGroups(['2026-06-10', '2026-06-11', '2026-06-12']))
    const nav = useDayNavigation({ groups, storageKey: 'test-upcoming', defaultIndex: 'first' })

    expect(nav.currentIndex.value).toBe(0)
  })

  it('currentGroup returns the group at currentIndex', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    expect(nav.currentGroup.value?.date).toBe('2026-06-01')
  })

  it('goNext increments index', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    nav.goNext()
    expect(nav.currentIndex.value).toBe(1)
    expect(nav.currentGroup.value?.date).toBe('2026-06-02')
  })

  it('goNext does not exceed max index', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'last' })

    expect(nav.currentIndex.value).toBe(1)
    nav.goNext()
    expect(nav.currentIndex.value).toBe(1)
  })

  it('goPrev decrements index', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'last' })

    nav.goPrev()
    expect(nav.currentIndex.value).toBe(1)
  })

  it('goPrev does not go below 0', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    nav.goPrev()
    expect(nav.currentIndex.value).toBe(0)
  })

  it('showAll sets index to null', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    nav.showAll()
    expect(nav.currentIndex.value).toBeNull()
    expect(nav.isShowingAll.value).toBe(true)
  })

  it('showSingleDay restores default index from null', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'last' })

    nav.showAll()
    expect(nav.isShowingAll.value).toBe(true)

    nav.showSingleDay()
    expect(nav.currentIndex.value).toBe(2)
    expect(nav.isShowingAll.value).toBe(false)
  })

  it('canGoNext is false at last index', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'last' })

    expect(nav.canGoNext.value).toBe(false)
    expect(nav.canGoPrev.value).toBe(true)
  })

  it('canGoPrev is false at index 0', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    expect(nav.canGoPrev.value).toBe(false)
    expect(nav.canGoNext.value).toBe(true)
  })

  it('canGoNext and canGoPrev are false when showing all', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    nav.showAll()
    expect(nav.canGoNext.value).toBe(false)
    expect(nav.canGoPrev.value).toBe(false)
  })

  it('dateLabel returns formatted Hungarian date', () => {
    const groups = computed(() => makeGroups(['2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test', defaultIndex: 'first' })

    expect(nav.dateLabel.value).toContain('3')
    expect(nav.dateLabel.value.length).toBeGreaterThan(0)
  })

  it('persists mode to localStorage on navigation', () => {
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test-persist', defaultIndex: 'first' })

    nav.goNext()
    expect(localStorage.getItem('test-persist')).toBe('day')

    nav.showAll()
    expect(localStorage.getItem('test-persist')).toBe('null')
  })

  it('reads null from localStorage as show-all mode on init', () => {
    localStorage.setItem('test-restore', 'null')
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test-restore', defaultIndex: 'first' })

    expect(nav.currentIndex.value).toBeNull()
    expect(nav.isShowingAll.value).toBe(true)
  })

  it('always starts at defaultIndex position on page load (not persisted index)', () => {
    localStorage.setItem('test-default', 'day')
    const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
    const nav = useDayNavigation({ groups, storageKey: 'test-default', defaultIndex: 'last' })

    expect(nav.currentIndex.value).toBe(2)
  })

  it('clamps index when groups shrink', async () => {
    const dates = ref(['2026-06-01', '2026-06-02', '2026-06-03'])
    const groups = computed(() => makeGroups(dates.value))
    const nav = useDayNavigation({ groups, storageKey: 'test-shrink', defaultIndex: 'last' })

    expect(nav.currentIndex.value).toBe(2)

    dates.value = ['2026-06-01']
    await nextTick()
    expect(nav.currentIndex.value).toBe(0)
  })

  it('currentGroup is null when groups are empty', () => {
    const groups = computed(() => makeGroups([]))
    const nav = useDayNavigation({ groups, storageKey: 'test-empty', defaultIndex: 'first' })

    expect(nav.currentGroup.value).toBeNull()
    expect(nav.canGoNext.value).toBe(false)
    expect(nav.canGoPrev.value).toBe(false)
  })

  describe('defaultShowAll option', () => {
    it('starts in show-all mode when defaultShowAll is true and no localStorage value', () => {
      const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
      const nav = useDayNavigation({
        groups,
        storageKey: 'test-default-all',
        defaultIndex: 'first',
        defaultShowAll: true,
      })

      expect(nav.currentIndex.value).toBeNull()
      expect(nav.isShowingAll.value).toBe(true)
    })

    it('respects stored "day" value over defaultShowAll', () => {
      localStorage.setItem('test-stored-day', 'day')
      const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02', '2026-06-03']))
      const nav = useDayNavigation({
        groups,
        storageKey: 'test-stored-day',
        defaultIndex: 'first',
        defaultShowAll: true,
      })

      expect(nav.currentIndex.value).toBe(0)
      expect(nav.isShowingAll.value).toBe(false)
    })

    it('respects stored "null" value when defaultShowAll is false', () => {
      localStorage.setItem('test-stored-null', 'null')
      const groups = computed(() => makeGroups(['2026-06-01', '2026-06-02']))
      const nav = useDayNavigation({
        groups,
        storageKey: 'test-stored-null',
        defaultIndex: 'first',
        defaultShowAll: false,
      })

      expect(nav.isShowingAll.value).toBe(true)
    })

    it('starts in show-all mode when groups arrive after init and defaultShowAll is true', async () => {
      const dates = ref<string[]>([])
      const groups = computed(() => makeGroups(dates.value))
      const nav = useDayNavigation({
        groups,
        storageKey: 'test-late-groups',
        defaultIndex: 'first',
        defaultShowAll: true,
      })

      expect(nav.currentIndex.value).toBeNull()

      dates.value = ['2026-06-01', '2026-06-02']
      await nextTick()

      expect(nav.currentIndex.value).toBeNull()
      expect(nav.isShowingAll.value).toBe(true)
    })
  })
})
