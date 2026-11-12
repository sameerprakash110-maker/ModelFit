import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward API calls to the FastAPI backend (uvicorn on :8000) so the browser sees one origin.
    // Set MODELFIT_API_TARGET to point the dev server at a backend elsewhere.
    proxy: {
      '/api': process.env.MODELFIT_API_TARGET ?? 'http://localhost:8000',
    },
  },
})
