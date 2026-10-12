import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Many jsdom files run in parallel; the default 5 s is too tight on slower machines and caused false failures.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});