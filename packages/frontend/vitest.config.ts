import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.vue'],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    passWithNoTests: true,
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/main.ts'],
      reporter: ['text', 'html'],
    },
  },
})
