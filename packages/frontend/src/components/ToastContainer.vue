<template>
  <div
    class="pointer-events-none fixed z-50 flex flex-col gap-2 max-md:bottom-4 max-md:left-1/2 max-md:-translate-x-1/2 max-md:w-[calc(100%-2rem)] max-md:max-w-sm md:bottom-6 md:right-6 md:items-end"
    role="region"
    aria-label="Notifications"
    data-testid="toast-container"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastStore.toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto rounded-lg px-4 py-3 shadow-lg text-sm font-medium text-white max-w-sm w-full md:w-auto md:min-w-[16rem]',
          typeClass(toast.type),
        ]"
        role="alert"
        :data-testid="`toast-${toast.type}`"
        @click="toastStore.removeToast(toast.id)"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { useToastStore, type ToastType } from '../stores/toast.store.js'

const toastStore = useToastStore()

function typeClass(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'bg-green-600'
    case 'info':
      return 'bg-blue-700'
    case 'error':
      return 'bg-red-600'
    case 'warning':
      return 'bg-amber-500'
  }
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: transform 250ms ease, opacity 250ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
.toast-enter-to,
.toast-leave-from {
  opacity: 1;
  transform: translateY(0);
}
.toast-move {
  transition: transform 250ms ease;
}
</style>
