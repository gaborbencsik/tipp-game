import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/db/migrate.ts', 'src/db/seed.ts'],
      reporter: ['text', 'html'],
    },
  },
})
