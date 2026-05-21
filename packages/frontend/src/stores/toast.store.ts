import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'info' | 'error' | 'warning'

export interface Toast {
  readonly id: string
  readonly message: string
  readonly type: ToastType
}

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 3000

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function addToast(message: string, type: ToastType): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    toasts.value.push({ id, message, type })
    while (toasts.value.length > MAX_VISIBLE) {
      const dropped = toasts.value.shift()
      if (dropped) {
        const t = timers.get(dropped.id)
        if (t) {
          clearTimeout(t)
          timers.delete(dropped.id)
        }
      }
    }
    const handle = setTimeout(() => {
      removeToast(id)
    }, AUTO_DISMISS_MS)
    timers.set(id, handle)
    return id
  }

  function removeToast(id: string): void {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx === -1) return
    toasts.value.splice(idx, 1)
    const handle = timers.get(id)
    if (handle) {
      clearTimeout(handle)
      timers.delete(id)
    }
  }

  return {
    toasts,
    addToast,
    removeToast,
  }
})
