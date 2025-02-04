import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({fastRefresh: true})],
  build: {
    sourcemap: true,
  },
  server: {
    host: true, // This makes it accessible from other devices
    port: 5173,
    strictPort: true,
    sourcemap: true
  }
})