import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Component/provider specs opt into jsdom per file via `// @vitest-environment jsdom`.
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
