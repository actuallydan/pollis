import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load VITE_* env vars from the monorepo root so we only need a single .env.local
  envDir: '..',
  server: {
    // Handle client-side routing for desktop auth pages
    // When browser opens to /desktop-auth, serve index.html
    // so React Router (or our pathname-based routing) can handle it

    // Configure HMR to avoid wails.localhost WebSocket errors
    // Wails dev mode runs on localhost, not wails.localhost
    hmr: {
      host: 'localhost',
    },
  },
})
