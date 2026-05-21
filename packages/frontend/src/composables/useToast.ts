import { useToastStore, type ToastType } from '../stores/toast.store.js'

interface UseToastApi {
  showToast: (message: string, type: ToastType) => string
  removeToast: (id: string) => void
}

export function useToast(): UseToastApi {
  const store = useToastStore()
  return {
    showToast: (message: string, type: ToastType): string => store.addToast(message, type),
    removeToast: (id: string): void => store.removeToast(id),
  }
}
