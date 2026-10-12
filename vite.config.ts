import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: mode === 'doctor' ? 'dist-doctor' : mode === 'patient' ? 'dist-patient' : 'dist',
  },
}))
