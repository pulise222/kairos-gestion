import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, el front pide "/api/..." a su propio servidor y Vite lo reenvía a la API (puerto 3001).
// En producción hace lo mismo nginx. Así no hay CORS ni direcciones fijas en el código.
const api = { '/api': { target: 'http://localhost:3001', changeOrigin: false }, '/uploads': { target: 'http://localhost:3001', changeOrigin: false }, '/personalizacion': { target: 'http://localhost:3001', changeOrigin: false } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: api },
  preview: { proxy: api },
})
