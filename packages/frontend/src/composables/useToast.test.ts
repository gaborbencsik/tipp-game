import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToast } from './useToast.js'
import { useToastStore } from '../stores/toast.store.js'

describe('useToast', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('showToast adds a toast to the store', () => {
    const { showToast } = useToast()
    const store = useToastStore()
    const id = showToast('Hello', 'success')
    expect(store.toasts).toHaveLength(1)
    expect(store.toasts[0]?.id).toBe(id)
    expect(store.toasts[0]?.message).toBe('Hello')
    expect(store.toasts[0]?.type).toBe('success')
  })

  it('removeToast removes a toast from the store', () => {
    const { showToast, removeToast } = useToast()
    const store = useToastStore()
    const id = showToast('Hello', 'success')
    removeToast(id)
    expect(store.toasts).toHaveLength(0)
  })
})
