import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['src/lib/**/*.spec.ts'],
      reporter: ['text', 'json-summary'],
      // Floor at current level; ratchet up as lib tests are added.
      thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 },
    },
  },
});
