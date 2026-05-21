import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ToastContainer from '@/components/ToastContainer.vue'
import { useToastStore } from '@/stores/toast.store'

function mountContainer() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(ToastContainer, {
    global: { plugins: [pinia] },
  })
}

describe('ToastContainer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders no toasts when store is empty', () => {
    const wrapper = mountContainer()
    expect(wrapper.find('[data-testid="toast-container"]').exists()).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('renders a success toast', async () => {
    const wrapper = mountContainer()
    const store = useToastStore()
    store.addToast('Tipp elmentve: 2 - 1', 'success')
    await flushPromises()
    const toast = wrapper.find('[data-testid="toast-success"]')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toBe('Tipp elmentve: 2 - 1')
    expect(toast.classes()).toContain('bg-green-600')
  })

  it('renders error toast with red background', async () => {
    const wrapper = mountContainer()
    const store = useToastStore()
    store.addToast('Hiba!', 'error')
    await flushPromises()
    const toast = wrapper.find('[data-testid="toast-error"]')
    expect(toast.exists()).toBe(true)
    expect(toast.classes()).toContain('bg-red-600')
  })

  it('renders warning toast with amber background', async () => {
    const wrapper = mountContainer()
    const store = useToastStore()
    store.addToast('Add meg mindkét értéket!', 'warning')
    await flushPromises()
    const toast = wrapper.find('[data-testid="toast-warning"]')
    expect(toast.exists()).toBe(true)
    expect(toast.classes()).toContain('bg-amber-500')
  })

  it('renders info toast with blue background', async () => {
    const wrapper = mountContainer()
    const store = useToastStore()
    store.addToast('3 tipp leadható ma!', 'info')
    await flushPromises()
    const toast = wrapper.find('[data-testid="toast-info"]')
    expect(toast.exists()).toBe(true)
    expect(toast.classes()).toContain('bg-blue-700')
  })

  it('clicking a toast removes it', async () => {
    const wrapper = mountContainer()
    const store = useToastStore()
    store.addToast('A', 'success')
    await flushPromises()
    await wrapper.find('[data-testid="toast-success"]').trigger('click')
    await flushPromises()
    expect(store.toasts).toHaveLength(0)
  })
})
