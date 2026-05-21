import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from './toast.store.js'

describe('useToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty toast list', () => {
    const store = useToastStore()
    expect(store.toasts).toEqual([])
  })

  it('addToast appends a toast with id, message, type', () => {
    const store = useToastStore()
    const id = store.addToast('Tipp elmentve: 2 - 1', 'success')
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]?.id).toBe(id)
    expect(store.toasts[0]?.message).toBe('Tipp elmentve: 2 - 1')
    expect(store.toasts[0]?.type).toBe('success')
  })

  it('addToast assigns unique ids', () => {
    const store = useToastStore()
    const id1 = store.addToast('a', 'success')
    const id2 = store.addToast('b', 'info')
    expect(id1).not.toBe(id2)
  })

  it('removeToast removes by id', () => {
    const store = useToastStore()
    const id = store.addToast('a', 'success')
    store.addToast('b', 'info')
    store.removeToast(id)
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]?.message).toBe('b')
  })

  it('removeToast on unknown id is a no-op', () => {
    const store = useToastStore()
    store.addToast('a', 'success')
    store.removeToast('unknown')
    expect(store.toasts).toHaveLength(1)
  })

  it('auto-dismisses after 3 seconds', () => {
    const store = useToastStore()
    store.addToast('a', 'success')
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(2999)
    expect(store.toasts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.toasts).toHaveLength(0)
  })

  it('caps visible toasts at 3 — oldest removed when 4th added', () => {
    const store = useToastStore()
    store.addToast('a', 'success')
    store.addToast('b', 'info')
    store.addToast('c', 'warning')
    store.addToast('d', 'error')
    expect(store.toasts).toHaveLength(3)
    expect(store.toasts.map(t => t.message)).toEqual(['b', 'c', 'd'])
  })

  it('manual removeToast cancels auto-dismiss timer (no double removal)', () => {
    const store = useToastStore()
    const id = store.addToast('a', 'success')
    store.removeToast(id)
    expect(store.toasts).toHaveLength(0)
    vi.advanceTimersByTime(3000)
    expect(store.toasts).toHaveLength(0)
  })

  it('supports all four types: success, info, error, warning', () => {
    const types = ['success', 'info', 'error', 'warning'] as const
    for (const type of types) {
      setActivePinia(createPinia())
      const store = useToastStore()
      store.addToast('msg', type)
      expect(store.toasts[0]?.type).toBe(type)
    }
  })
})
